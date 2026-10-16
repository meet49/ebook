import { Router } from 'express';
import { z } from 'zod';
import { emailSchema, nameSchema } from '@ebook/shared';
import { audit } from '../../lib/audit';
import { HttpError, badRequest, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { getRazorpayCredentials } from '../../lib/payments/config';
import { getGateway, paymentsMode } from '../../lib/payments/gateway';
import { verifyCheckoutSignature } from '../../lib/payments/signature';
import { sensitiveLimiter } from '../../middleware/rateLimit';
import { parse } from '../../middleware/validate';
import { Entitlement } from '../../models/Entitlement';
import { Order } from '../../models/Order';
import { Product } from '../../models/Product';
import { User, type UserDoc } from '../../models/User';
import { resolveAttribution } from '../affiliates/attribution';
import { PaymentMismatchError, assertPaymentMatchesOrder, fulfilOrder, newOrderNumber } from './fulfilment';

export const checkoutRouter = Router();

const createOrderSchema = z.object({
  productSlug: z.string().trim().toLowerCase().max(80),
  /** Required only for guests; ignored when signed in. */
  name: nameSchema.optional(),
  email: emailSchema.optional(),
});

/**
 * Guests: an existing account with this email gets the purchase attached — but no session.
 * Access is delivered through the emailed sign-in link, so knowing someone's email never
 * grants entry to their library. New emails get a passwordless customer account.
 */
async function resolveBuyer(auth: Express.Request['auth'], name?: string, email?: string): Promise<{ user: UserDoc; signedIn: boolean }> {
  if (auth) return { user: auth.user, signedIn: true };
  if (!name || !email) {
    throw badRequest('Enter your name and email', {
      ...(name ? {} : { name: ['Enter your name'] }),
      ...(email ? {} : { email: ['Enter your email'] }),
    });
  }
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.status !== 'active') throw new HttpError(403, 'ACCOUNT_SUSPENDED', 'This account cannot make purchases. Please contact support.');
    return { user: existing, signedIn: false };
  }
  try {
    return { user: await User.create({ name, email, roles: ['customer'] }), signedIn: false };
  } catch (err) {
    // Two simultaneous guest checkouts with the same new email.
    if ((err as { code?: number }).code === 11000) return { user: (await User.findOne({ email }))!, signedIn: false };
    throw err;
  }
}

checkoutRouter.get('/config', async (_req, res) => {
  res.json({ mode: await paymentsMode() });
});

checkoutRouter.post('/orders', sensitiveLimiter, async (req, res) => {
  const input = parse(createOrderSchema, req.body);
  const product = await Product.findOne({ slug: input.productSlug, status: 'published' });
  if (!product) throw notFound('This eBook is not available');

  const gw = await getGateway(); // 503 if payments are not configured
  const { user, signedIn } = await resolveBuyer(req.auth, input.name, input.email);

  if (await Entitlement.exists({ userId: user._id, productId: product._id, status: 'active' })) {
    throw new HttpError(
      409,
      'ALREADY_OWNED',
      signedIn ? 'You already own this eBook.' : 'This email already owns this eBook. Sign in to read it.',
    );
  }

  // Price and commission always come from the server-side product, never the browser.
  const amountPaise = product.effectivePricePaise;
  const attribution = await resolveAttribution(req, user, product);
  const orderNumber = newOrderNumber();
  const rzpOrder = await gw.createOrder({
    amount: amountPaise,
    currency: 'INR',
    receipt: orderNumber,
    notes: { orderNumber, productId: product._id.toString(), userId: user._id.toString() },
  });
  if (rzpOrder.amount !== amountPaise) throw new HttpError(502, 'GATEWAY_ERROR', 'Payment provider returned an unexpected amount');

  const order = await Order.create({
    orderNumber,
    userId: user._id,
    productId: product._id,
    productSnapshot: { title: product.title, slug: product.slug },
    customerSnapshot: { name: user.name, email: user.email },
    amountPaise,
    currency: 'INR',
    razorpay: { orderId: rzpOrder.id },
    attribution,
  });
  await audit({ action: 'order.created', entityType: 'Order', entityId: order._id, actorId: user._id, meta: { attribution: attribution.type }, req });

  res.status(201).json({
    orderNumber,
    razorpayOrderId: rzpOrder.id,
    amountPaise,
    currency: 'INR',
    keyId: gw.keyId,
    product: { title: product.title, slug: product.slug },
    prefill: { name: user.name, email: user.email },
  });
});

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid signature'),
});

/**
 * Called by the browser after Razorpay Checkout succeeds. The signature proves the IDs came
 * from Razorpay; we then fetch the payment server-side and check status and amount before
 * granting access. The webhook performs the same fulfilment independently.
 */
checkoutRouter.post('/verify', sensitiveLimiter, async (req, res) => {
  const body = parse(verifySchema, req.body);
  const order = await Order.findOne({ 'razorpay.orderId': body.razorpay_order_id });
  if (!order) throw notFound('Order not found');

  const creds = await getRazorpayCredentials();
  if (!creds || !verifyCheckoutSignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature, creds.keySecret)) {
    await audit({ action: 'order.signature_invalid', entityType: 'Order', entityId: order._id, req });
    throw new HttpError(400, 'INVALID_SIGNATURE', 'Payment verification failed. If money was deducted, it will be reconciled automatically.');
  }

  const gw = await getGateway();
  let payment = await gw.fetchPayment(body.razorpay_payment_id);
  if (payment.status === 'authorized' && payment.order_id === order.razorpay?.orderId && payment.amount === order.amountPaise) {
    payment = await gw.capturePayment(payment.id, order.amountPaise, order.currency);
  }
  try {
    assertPaymentMatchesOrder(order, payment);
  } catch (err) {
    if (err instanceof PaymentMismatchError) {
      logger.warn({ orderNumber: order.orderNumber, reason: err.message }, 'Payment verification mismatch');
      await audit({ action: 'order.verification_mismatch', entityType: 'Order', entityId: order._id, meta: { reason: err.message }, req });
      throw new HttpError(409, 'PAYMENT_NOT_CAPTURED', 'We could not confirm this payment yet. We will email you as soon as it is confirmed.');
    }
    throw err;
  }

  const fulfilled = await fulfilOrder(order._id, payment, 'verify');
  res.json({ status: fulfilled.status, orderNumber: fulfilled.orderNumber });
});

/**
 * Minimal, non-sensitive status for the confirmation page. The order number is unguessable
 * and the response contains no personal data beyond a masked email.
 */
checkoutRouter.get('/orders/:orderNumber', async (req, res) => {
  const orderNumber = String(req.params.orderNumber);
  if (!/^EB-\d{8}-[A-Z2-9]{6}$/.test(orderNumber)) throw notFound('Order not found');
  const order = await Order.findOne({ orderNumber });
  if (!order) throw notFound('Order not found');
  const email = order.customerSnapshot?.email ?? '';
  const [local = '', domain = ''] = email.split('@');
  res.json({
    orderNumber: order.orderNumber,
    status: order.status,
    product: order.productSnapshot,
    amountPaise: order.amountPaise,
    maskedEmail: local ? `${local.slice(0, 2)}${'•'.repeat(Math.max(1, local.length - 2))}@${domain}` : null,
    isOwner: Boolean(req.auth && req.auth.user._id.equals(order.userId)),
  });
});
