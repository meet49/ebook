import { Router } from 'express';
import { z } from 'zod';
import { emailSchema, nameSchema, type CheckoutQuote, type ComboOffers } from '@ebook/shared';
import { audit } from '../../lib/audit';
import { HttpError, badRequest, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { getRazorpayCredentials } from '../../lib/payments/config';
import { isInternational } from '../../lib/region';
import { getGateway, paymentsMode } from '../../lib/payments/gateway';
import { verifyCheckoutSignature } from '../../lib/payments/signature';
import { sensitiveLimiter } from '../../middleware/rateLimit';
import { parse } from '../../middleware/validate';
import { Entitlement } from '../../models/Entitlement';
import { Order } from '../../models/Order';
import { Product } from '../../models/Product';
import { User, type UserDoc } from '../../models/User';
import { couponAttribution, resolveAttribution } from '../affiliates/attribution';
import { authorSnapshots } from '../authors/earnings';
import { toSummary } from '../products/products.service';
import { PaymentMismatchError, assertPaymentMatchesOrder, fulfilOrder, newOrderNumber } from './fulfilment';
import { orderLines, publicLine } from './lines';
import { MAX_ADD_ONS, comboCandidates, offersForUser, priceOrder, recentBuyerOf, type PricedOrder } from './pricing';

export const checkoutRouter = Router();

const slugSchema = z.string().trim().toLowerCase().max(80);
const ORDER_NUMBER = /^EB-\d{8}-[A-Z2-9]{6}$/;

const createOrderSchema = z.object({
  productSlug: slugSchema,
  /** Same-category books added at their combo price. */
  addOnSlugs: z.array(slugSchema).max(MAX_ADD_ONS).default([]),
  couponCode: z.string().trim().max(20).optional(),
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

  if (product.kind !== 'membership' && (await Entitlement.exists({ userId: user._id, productId: product._id, status: 'active' }))) {
    throw new HttpError(
      409,
      'ALREADY_OWNED',
      signedIn ? 'You already own this eBook.' : 'This email already owns this eBook. Sign in to read it.',
    );
  }

  // Prices, combo eligibility and commission always come from the server, never the browser.
  const priced = await priceOrder(product, input.addOnSlugs, user._id, { international: isInternational(req), couponCode: input.couponCode });
  const extras = priced.lines.slice(1).map((l) => l.product);
  if (extras.length) {
    const owned = await Entitlement.findOne({ userId: user._id, productId: { $in: extras.map((p) => p._id) }, status: 'active' });
    if (owned) {
      const book = extras.find((p) => p._id.equals(owned.productId));
      throw new HttpError(409, 'ALREADY_OWNED', `You already own “${book?.title ?? 'one of these books'}”. Remove it from this order to continue.`, {
        addOnSlugs: [book?.slug ?? ''],
      });
    }
  }
  const amountPaise = priced.totalPaise;
  const books = priced.lines.map((l) => l.product);
  // A coupon that belongs to an affiliate credits them; otherwise the usual link attribution.
  const viaCoupon = priced.coupon?.coupon.affiliateId ? await couponAttribution(priced.coupon.coupon.affiliateId, user, books) : null;
  const attribution = viaCoupon ?? (await resolveAttribution(req, user, books));
  const authors = await authorSnapshots(books);
  const orderNumber = newOrderNumber();
  const rzpOrder = await gw.createOrder({
    amount: amountPaise,
    currency: 'INR',
    receipt: orderNumber,
    notes: {
      orderNumber,
      productId: product._id.toString(),
      ...(extras.length ? { addOnIds: extras.map((p) => p._id.toString()).join(',') } : {}),
      userId: user._id.toString(),
    },
  });
  if (rzpOrder.amount !== amountPaise) throw new HttpError(502, 'GATEWAY_ERROR', 'Payment provider returned an unexpected amount');

  const order = await Order.create({
    orderNumber,
    userId: user._id,
    productId: product._id,
    productSnapshot: { title: product.title, slug: product.slug },
    items: priced.lines.map((l) => ({
      productId: l.product._id,
      title: l.product.title,
      slug: l.product.slug,
      listPricePaise: l.listPricePaise,
      pricePaise: l.pricePaise,
      combo: l.combo,
      displayPriceMinor: l.displayPriceMinor,
      couponDiscountPaise: l.couponDiscountPaise ?? 0,
      membershipDays: l.product.kind === 'membership' ? (l.product.membership?.durationDays ?? null) : null,
      authorProfileId: authors.get(l.product._id.toString())?.authorProfileId ?? null,
      authorSharePercent: authors.get(l.product._id.toString())?.sharePercent ?? null,
      commissionRule: l.product.affiliate?.enabled
        ? { type: l.product.affiliate.type ?? 'percent', value: l.product.affiliate.value ?? 0 }
        : null,
    })),
    customerSnapshot: { name: user.name, email: user.email },
    amountPaise,
    currency: 'INR',
    display: { currency: priced.currency, totalMinor: priced.totalDisplayMinor, fxRate: priced.fxRate },
    coupon: priced.coupon
      ? { couponId: priced.coupon.coupon._id, code: priced.coupon.coupon.code, discountPaise: priced.coupon.discountPaise }
      : { couponId: null, code: null, discountPaise: 0 },
    razorpay: { orderId: rzpOrder.id },
    attribution,
  });
  await audit({ action: 'order.created', entityType: 'Order', entityId: order._id, actorId: user._id, meta: { attribution: attribution.type, books: priced.lines.length, combo: priced.lines.some((l) => l.combo), display: priced.currency }, req });

  res.status(201).json({
    orderNumber,
    razorpayOrderId: rzpOrder.id,
    amountPaise,
    currency: 'INR',
    display: { currency: priced.currency, totalMinor: priced.totalDisplayMinor, fxRate: priced.fxRate },
    coupon: priced.coupon ? { code: priced.coupon.coupon.code, discountPaise: priced.coupon.discountPaise } : null,
    keyId: gw.keyId,
    product: { title: product.title, slug: product.slug },
    lines: priced.lines.map(lineOf),
    prefill: { name: user.name, email: user.email },
  });
});

function lineOf(l: PricedOrder['lines'][number]) {
  return {
    title: l.product.title,
    slug: l.product.slug,
    listPricePaise: l.listPricePaise,
    pricePaise: l.pricePaise,
    combo: l.combo,
    displayListMinor: l.displayListMinor,
    displayPriceMinor: l.displayPriceMinor,
    couponDisplayMinor: l.couponDisplayMinor ?? 0,
  };
}

const quoteSchema = z.object({
  productSlug: slugSchema,
  addOnSlugs: z.array(slugSchema).max(MAX_ADD_ONS).default([]),
  /** A guest's just-paid order, so the confirmation page's combo offer shows the right price. */
  fromOrder: z.string().regex(ORDER_NUMBER).optional(),
  couponCode: z.string().trim().max(20).optional(),
});

/**
 * The price breakdown to show before paying. Signed-in buyers see their own combo window; a
 * guest coming from a just-paid order sees that order's. The order is always re-priced when
 * it is created, for whoever actually buys.
 */
checkoutRouter.post('/quote', async (req, res) => {
  const input = parse(quoteSchema, req.body);
  const product = await Product.findOne({ slug: input.productSlug, status: 'published' });
  if (!product) throw notFound('This eBook is not available');
  const userId = req.auth?.user._id ?? (input.fromOrder ? await recentBuyerOf(input.fromOrder) : null);

  const priced = await priceOrder(product, input.addOnSlugs, userId, { international: isInternational(req), couponCode: input.couponCode, lenientCoupon: true });
  const addOns = await comboCandidates(product.categories, [product._id], userId);
  const quote: CheckoutQuote = {
    lines: priced.lines.map(lineOf),
    totalPaise: priced.totalPaise,
    savingsPaise: priced.lines.reduce((sum, l) => sum + (l.listPricePaise - l.pricePaise), 0),
    currency: priced.currency,
    totalDisplayMinor: priced.totalDisplayMinor,
    savingsDisplayMinor: priced.lines.reduce((sum, l) => sum + (l.displayListMinor - l.displayPriceMinor), 0),
    fxRate: priced.fxRate,
    coupon: priced.coupon
      ? { code: priced.coupon.coupon.code, discountPaise: priced.coupon.discountPaise, discountDisplayMinor: priced.coupon.discountDisplayMinor }
      : null,
    couponError: priced.couponError,
    addOns: addOns.map(toSummary),
    offerExpiresAt: priced.offerExpiresAt?.toISOString() ?? null,
  };
  res.setHeader('Cache-Control', 'no-store');
  res.json({ quote });
});

/** Combo offers on the confirmation page, for 24 hours after the purchase. */
checkoutRouter.get('/orders/:orderNumber/offers', async (req, res) => {
  const orderNumber = String(req.params.orderNumber);
  if (!ORDER_NUMBER.test(orderNumber)) throw notFound('Order not found');
  const userId = await recentBuyerOf(orderNumber);
  const offers = userId ? await offersForUser(userId) : { expiresAt: null, products: [] };
  const body: ComboOffers = { expiresAt: offers.expiresAt?.toISOString() ?? null, items: offers.products.map(toSummary) };
  res.setHeader('Cache-Control', 'no-store');
  res.json({ offers: body });
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
  if (!ORDER_NUMBER.test(orderNumber)) throw notFound('Order not found');
  const order = await Order.findOne({ orderNumber });
  if (!order) throw notFound('Order not found');
  const email = order.customerSnapshot?.email ?? '';
  const [local = '', domain = ''] = email.split('@');
  res.json({
    orderNumber: order.orderNumber,
    status: order.status,
    product: order.productSnapshot,
    lines: orderLines(order).map(publicLine),
    /** A membership pass order: its books are in the library, not one reader link. */
    membership: orderLines(order).some((l) => Boolean(l.membershipDays)),
    amountPaise: order.amountPaise,
    maskedEmail: local ? `${local.slice(0, 2)}${'•'.repeat(Math.max(1, local.length - 2))}@${domain}` : null,
    isOwner: Boolean(req.auth && req.auth.user._id.equals(order.userId)),
  });
});
