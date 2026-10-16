import { Router, type Request } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { ORDER_STATUSES } from '@ebook/shared';
import { audit } from '../../lib/audit';
import { HttpError, badRequest, notFound } from '../../lib/errors';
import { getGateway } from '../../lib/payments/gateway';
import { parse } from '../../middleware/validate';
import { AffiliateProfile } from '../../models/AffiliateProfile';
import { Commission } from '../../models/Commission';
import { Order, type OrderDoc } from '../../models/Order';
import { PaymentEvent } from '../../models/PaymentEvent';
import { PaymentMismatchError, applyRefund, assertPaymentMatchesOrder, fulfilOrder } from '../checkout/fulfilment';
import { toAdminOrder } from '../checkout/orders.dto';

export const adminOrdersRouter = Router();

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function affiliateCodes(orders: OrderDoc[]): Promise<Map<string, string>> {
  const ids = orders.flatMap((o) => (o.attribution?.affiliateId ? [o.attribution.affiliateId] : []));
  if (!ids.length) return new Map();
  const profiles = await AffiliateProfile.find({ _id: { $in: ids } }).select('code');
  return new Map(profiles.map((p) => [p._id.toString(), p.code]));
}

async function loadOrder(req: Request): Promise<OrderDoc> {
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) throw notFound('Order not found');
  const order = await Order.findById(id);
  if (!order) throw notFound('Order not found');
  return order;
}

adminOrdersRouter.get('/', async (req, res) => {
  const { q, status, page, pageSize } = parse(listQuery, req.query);
  // Abandoned checkouts ("created") are hidden unless explicitly requested.
  const filter: Record<string, unknown> = status ? { status } : { status: { $ne: 'created' } };
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ orderNumber: rx }, { 'customerSnapshot.email': rx }, { 'productSnapshot.title': rx }, { 'razorpay.paymentId': q }];
  }
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    Order.countDocuments(filter),
  ]);
  const codes = await affiliateCodes(items);
  res.json({
    items: items.map((o) => toAdminOrder(o, o.attribution?.affiliateId ? codes.get(o.attribution.affiliateId.toString()) : null)),
    page,
    pageSize,
    total,
  });
});

adminOrdersRouter.get('/:id', async (req, res) => {
  const order = await loadOrder(req);
  const [codes, events, commission] = await Promise.all([
    affiliateCodes([order]),
    PaymentEvent.find({ orderId: order._id }).sort({ createdAt: 1 }).select('eventId type status error createdAt'),
    Commission.findOne({ orderId: order._id }).select('amountPaise status clawbackRequired'),
  ]);
  res.json({
    order: toAdminOrder(order, order.attribution?.affiliateId ? codes.get(order.attribution.affiliateId.toString()) : null),
    events: events.map((e) => ({ eventId: e.eventId, type: e.type, status: e.status, error: e.error ?? null, createdAt: e.createdAt.toISOString() })),
    commission: commission
      ? { amountPaise: commission.amountPaise, status: commission.status, clawbackRequired: commission.clawbackRequired }
      : null,
  });
});

const refundBody = z.object({
  /** Omit for a full refund of the remaining amount. */
  amountPaise: z.number().int().min(100).optional(),
  reason: z.string().trim().min(3, 'Give a short reason').max(300),
});

/** Issues a real refund through Razorpay. Access and commission change when it is processed. */
adminOrdersRouter.post('/:id/refund', async (req, res) => {
  const { amountPaise, reason } = parse(refundBody, req.body);
  const order = await loadOrder(req);
  if (!['paid', 'partially_refunded'].includes(order.status) || !order.razorpay?.paymentId) {
    throw new HttpError(409, 'NOT_REFUNDABLE', 'Only paid orders can be refunded');
  }
  const pending = order.refunds.filter((r) => r.status !== 'failed').reduce((s, r) => s + (r.amountPaise ?? 0), 0);
  const remaining = order.amountPaise - pending;
  const amount = amountPaise ?? remaining;
  if (amount <= 0 || amount > remaining) throw badRequest(`You can refund at most ${remaining} paise`, { amountPaise: ['Amount exceeds the refundable balance'] });

  const refund = await (await getGateway()).refund(order.razorpay.paymentId, amount, { orderNumber: order.orderNumber, reason });
  const updated = await applyRefund(order._id, refund, req.auth!.user._id);
  await audit({ action: 'admin.refund_issued', entityType: 'Order', entityId: order._id, meta: { amountPaise: amount, reason, refundId: refund.id }, req });
  res.json({ order: toAdminOrder(updated!) });
});

/**
 * Re-checks an unpaid order with Razorpay. Recovers orders where the customer paid but
 * neither the browser callback nor the webhook reached us.
 */
adminOrdersRouter.post('/:id/reconcile', async (req, res) => {
  const order = await loadOrder(req);
  if (!['created', 'failed'].includes(order.status)) throw new HttpError(409, 'ALREADY_SETTLED', 'This order is already settled');

  const payments = await (await getGateway()).listOrderPayments(order.razorpay!.orderId);
  const captured = payments.find((p) => {
    try {
      assertPaymentMatchesOrder(order, p);
      return true;
    } catch (err) {
      if (err instanceof PaymentMismatchError) return false;
      throw err;
    }
  });
  if (!captured) {
    res.json({ order: toAdminOrder(order), result: 'no_captured_payment', paymentsSeen: payments.map((p) => p.status) });
    return;
  }
  const fulfilled = await fulfilOrder(order._id, captured, 'reconcile');
  await audit({ action: 'admin.order_reconciled', entityType: 'Order', entityId: order._id, req });
  res.json({ order: toAdminOrder(fulfilled), result: 'fulfilled' });
});
