import { randomBytes } from 'node:crypto';
import type { Types } from 'mongoose';
import { formatINR } from '@ebook/shared';
import { env } from '../../config/env';
import { audit } from '../../lib/audit';
import { sendEmailInBackground } from '../../lib/email/transport';
import { purchaseTemplate } from '../../lib/email/templates';
import { logger } from '../../lib/logger';
import type { GatewayPayment } from '../../lib/payments/gateway';
import { AffiliateClick } from '../../models/AffiliateClick';
import { Entitlement } from '../../models/Entitlement';
import { Notification } from '../../models/Notification';
import { Order, type OrderDoc } from '../../models/Order';
import { User } from '../../models/User';
import { issueAuthToken } from '../auth/tokens';
import { adjustCommissionForRefund, createCommissionForOrder } from '../commissions/ledger';
import { grantPasses, revokePasses } from '../membership/passes';
import { orderLines } from './lines';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newOrderNumber(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const bytes = randomBytes(6);
  const suffix = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `EB-${date}-${suffix}`;
}

export class PaymentMismatchError extends Error {}

/** A payment can fulfil an order only if it belongs to it, is captured, and matches amount and currency exactly. */
export function assertPaymentMatchesOrder(order: OrderDoc, payment: GatewayPayment): void {
  if (payment.order_id !== order.razorpay?.orderId) throw new PaymentMismatchError('Payment belongs to a different order');
  if (payment.amount !== order.amountPaise) throw new PaymentMismatchError(`Amount mismatch: ${payment.amount} != ${order.amountPaise}`);
  if (payment.currency !== order.currency) throw new PaymentMismatchError('Currency mismatch');
  if (payment.status !== 'captured') throw new PaymentMismatchError(`Payment is ${payment.status}, not captured`);
}

/**
 * Marks an order paid and grants access. Idempotent: the browser's verify call and the
 * payment.captured webhook may both arrive, in any order, any number of times.
 */
export async function fulfilOrder(orderId: Types.ObjectId, payment: GatewayPayment, source: 'verify' | 'webhook' | 'reconcile'): Promise<OrderDoc> {
  const now = new Date();
  const transitioned = await Order.findOneAndUpdate(
    { _id: orderId, status: { $in: ['created', 'failed'] } },
    {
      $set: {
        status: 'paid',
        paidAt: now,
        'razorpay.paymentId': payment.id,
        'razorpay.method': payment.method ?? null,
        failureReason: null,
      },
    },
    { returnDocument: 'after' },
  );

  const order = transitioned ?? (await Order.findById(orderId));
  if (!order) throw new Error(`Order ${orderId.toString()} disappeared`);
  if (order.status !== 'paid' && order.status !== 'partially_refunded') {
    // Refunded orders never regain access through a late or replayed capture event.
    return order;
  }
  if (order.razorpay?.paymentId && order.razorpay.paymentId !== payment.id) {
    // A second successful payment for an already-paid order (e.g. two tabs). Needs a manual refund.
    logger.warn({ orderNumber: order.orderNumber, paymentId: payment.id }, 'Duplicate payment for a paid order');
    await audit({ action: 'order.duplicate_payment', entityType: 'Order', entityId: order._id, meta: { paymentId: payment.id } });
    return order;
  }

  // Each step below is individually idempotent, so a crash mid-way is repaired by the next event.
  await User.updateOne({ _id: order.userId }, { $addToSet: { roles: 'customer' } });
  for (const line of orderLines(order)) {
    if (line.membershipDays) continue;
    await Entitlement.updateOne(
      { userId: order.userId, productId: line.productId },
      {
        $set: { status: 'active', orderId: order._id, revokedAt: null, revokeReason: null },
        $setOnInsert: { grantedAt: now },
      },
      { upsert: true },
    );
  }
  await grantPasses(order, now);
  await createCommissionForOrder(order);
  if (order.attribution?.clickId) {
    await AffiliateClick.updateOne({ _id: order.attribution.clickId, convertedOrderId: null }, { $set: { convertedOrderId: order._id } });
  }

  if (transitioned) {
    await audit({
      action: 'order.paid',
      entityType: 'Order',
      entityId: order._id,
      actorId: order.userId,
      meta: { source, paymentId: payment.id, amountPaise: order.amountPaise, books: orderLines(order).length },
    });
    await Order.updateOne({ _id: order._id }, { $set: { fulfilledAt: now } });
  }
  await sendPurchaseEmailOnce(order);
  return order;
}

async function sendPurchaseEmailOnce(order: OrderDoc): Promise<void> {
  // Claim the send atomically so concurrent fulfilments email at most once.
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, purchaseEmailSentAt: null },
    { $set: { purchaseEmailSentAt: new Date() } },
  );
  if (!claimed) return;

  const user = await User.findById(order.userId).select('+passwordHash');
  if (!user) return;
  const lines = orderLines(order);
  const title =
    lines
      .map((l) => (l.membershipDays ? `ReadnShare Pass: ${l.title} (${l.membershipDays} days)` : l.title))
      .filter(Boolean)
      .join(' + ') || 'your eBook';
  // One book opens straight in the reader; a combo or a membership pass opens the library.
  const slug = lines.length === 1 && !lines[0]!.membershipDays ? lines[0]!.slug : undefined;
  const token = await issueAuthToken(user._id, 'magic_login', slug ? `/read/${slug}` : '/library', 72 * 60 * 60_000);

  sendEmailInBackground(
    purchaseTemplate(user.email, {
      name: user.name,
      title,
      orderNumber: order.orderNumber,
      amount: formatINR(order.amountPaise),
      url: `${env.APP_URL}/auth/magic?token=${encodeURIComponent(token)}`,
      newAccount: !user.passwordHash && !user.lastLoginAt,
    }),
  );
  await Notification.create({
    userId: user._id,
    type: 'purchase',
    title: lines.some((l) => l.membershipDays)
      ? `${title} is active`
      : lines.length > 1
        ? `${lines.length} eBooks are in your library`
        : `“${title}” is in your library`,
    body: `Order ${order.orderNumber}`,
    link: slug ? `/read/${slug}` : '/library',
  });
}

export async function markOrderFailed(razorpayOrderId: string, reason: string): Promise<void> {
  await Order.updateOne(
    { 'razorpay.orderId': razorpayOrderId, status: 'created' },
    { $set: { status: 'failed', failedAt: new Date(), failureReason: reason.slice(0, 300) } },
  );
}

/**
 * Records a refund (idempotent by refund id). Full refunds revoke reading access;
 * any refund re-bases or reverses the affiliate commission.
 */
export async function applyRefund(
  orderId: Types.ObjectId,
  refund: { id: string; amount: number; status: string },
  actorId?: Types.ObjectId | null,
): Promise<OrderDoc | null> {
  // Atomic, idempotent upsert of the refund entry: the admin's refund call and Razorpay's
  // refund webhooks can arrive concurrently and must never record the same refund twice.
  const inserted = await Order.updateOne(
    { _id: orderId, 'refunds.refundId': { $ne: refund.id } },
    { $push: { refunds: { refundId: refund.id, amountPaise: refund.amount, status: refund.status, createdAt: new Date() } } },
  );
  if (inserted.modifiedCount === 0) {
    const changed = await Order.updateOne(
      { _id: orderId, refunds: { $elemMatch: { refundId: refund.id, status: { $ne: refund.status } } } },
      { $set: { 'refunds.$.status': refund.status } },
    );
    if (changed.modifiedCount === 0) return Order.findById(orderId);
  }

  const order = await Order.findById(orderId);
  if (!order) return null;

  // Only processed refunds move money; pending ones are shown but do not change access yet.
  const refunded = order.refunds.filter((r) => r.status === 'processed').reduce((sum, r) => sum + (r.amountPaise ?? 0), 0);
  order.refundedPaise = Math.min(refunded, order.amountPaise);
  if (order.refundedPaise > 0 && ['paid', 'partially_refunded', 'refunded'].includes(order.status)) {
    order.status = order.refundedPaise >= order.amountPaise ? 'refunded' : 'partially_refunded';
  }
  await order.save();

  if (order.status === 'refunded') {
    await Entitlement.updateMany(
      { userId: order.userId, productId: { $in: orderLines(order).map((l) => l.productId) }, orderId: order._id, status: 'active' },
      { $set: { status: 'revoked', revokedAt: new Date(), revokeReason: 'Order refunded' } },
    );
    await revokePasses(order._id);
  }
  if (order.refundedPaise > 0) await adjustCommissionForRefund(order, actorId);
  await audit({ action: 'order.refund_recorded', entityType: 'Order', entityId: order._id, actorId, meta: { ...refund } });
  return order;
}
