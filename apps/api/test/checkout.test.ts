import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { devOutbox } from '../src/lib/email/transport';
import { hashPassword } from '../src/lib/crypto';
import { setGateway } from '../src/lib/payments/gateway';
import { Entitlement } from '../src/models/Entitlement';
import { Order } from '../src/models/Order';
import { PaymentEvent } from '../src/models/PaymentEvent';
import { Product } from '../src/models/Product';
import { User } from '../src/models/User';
import { calculateCommission } from '../src/modules/commissions/ledger';
import { FakeGateway, checkoutSignature, webhookSignature } from './fake-gateway';
import { agent, app, createUser } from './helpers';

let gw: FakeGateway;
const PASSWORD = 'pass-word-1';

beforeEach(async () => {
  gw = new FakeGateway();
  setGateway(gw);
  await Product.create({
    slug: 'deep-focus',
    title: 'Deep Focus',
    description: 'x',
    pricePaise: 100_000,
    salePricePaise: 79_900,
    status: 'published',
    publishedAt: new Date(),
  });
});

afterAll(() => setGateway(null));

function startCheckout(a = agent(), body: Record<string, unknown> = { name: 'Guest Buyer', email: 'guest@example.com' }) {
  return a.post('/api/v1/checkout/orders').send({ productSlug: 'deep-focus', ...body });
}

function sendWebhook(event: string, payload: unknown, eventId = `evt_${Math.random().toString(36).slice(2)}`) {
  const body = JSON.stringify({ event, payload });
  return request(app)
    .post('/api/v1/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', webhookSignature(body))
    .set('X-Razorpay-Event-Id', eventId)
    .send(body);
}

const purchaseEmails = () => devOutbox.filter((m) => m.subject.startsWith('Your eBook is ready'));

describe('commission calculation', () => {
  it('matches the documented example and caps fixed amounts', () => {
    expect(calculateCommission(100_000, { type: 'percent', value: 2000 })).toBe(20_000);
    expect(calculateCommission(99_999, { type: 'percent', value: 1250 })).toBe(12_499);
    expect(calculateCommission(5_000, { type: 'fixed', value: 9_000 })).toBe(5_000);
  });
});

describe('checkout order creation', () => {
  it('charges the server-side sale price and ignores client-supplied amounts', async () => {
    const res = await startCheckout(agent(), { name: 'Guest Buyer', email: 'guest@example.com', amountPaise: 100, pricePaise: 100 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ amountPaise: 79_900, currency: 'INR', keyId: 'rzp_test_unit' });
    expect(gw.orders.get(res.body.razorpayOrderId)!.amount).toBe(79_900);
    const order = await Order.findOne({ orderNumber: res.body.orderNumber });
    expect(order).toMatchObject({ status: 'created', amountPaise: 79_900 });
    expect(order!.attribution!.type).toBe('direct');
  });

  it('creates a passwordless customer for a new email without signing them in', async () => {
    const res = await startCheckout();
    expect(res.headers['set-cookie']).toBeUndefined();
    const user = await User.findOne({ email: 'guest@example.com' }).select('+passwordHash');
    expect(user).toMatchObject({ roles: ['customer'] });
    expect(user!.passwordHash).toBeUndefined();
  });

  it('attaches a guest purchase to an existing account without granting a session', async () => {
    const existing = await createUser({ email: 'owner@example.com', password: PASSWORD });
    const res = await startCheckout(agent(), { name: 'Someone', email: 'Owner@Example.com' });
    expect(res.status).toBe(201);
    expect(res.headers['set-cookie']).toBeUndefined();
    const order = await Order.findOne({ orderNumber: res.body.orderNumber });
    expect(order!.userId.equals(existing._id)).toBe(true);
    expect(await User.countDocuments()).toBe(1);
  });

  it('requires name and email from guests, and rejects unpublished books', async () => {
    const res = await agent().post('/api/v1/checkout/orders').send({ productSlug: 'deep-focus' });
    expect(res.status).toBe(400);
    await Product.updateOne({ slug: 'deep-focus' }, { $set: { status: 'unpublished' } });
    await startCheckout().expect(404);
  });

  it('refuses to sell a book the buyer already owns', async () => {
    const user = await createUser({ email: 'have@example.com', password: PASSWORD });
    const product = await Product.findOne({ slug: 'deep-focus' });
    await Entitlement.create({ userId: user._id, productId: product!._id });
    const a = agent();
    await a.post('/api/v1/auth/login').send({ email: 'have@example.com', password: PASSWORD });
    const res = await startCheckout(a, {});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_OWNED');
  });
});

describe('payment verification', () => {
  it('rejects a forged signature', async () => {
    const order = (await startCheckout()).body;
    const payment = gw.pay(order.razorpayOrderId);
    const res = await agent()
      .post('/api/v1/checkout/verify')
      .send({ razorpay_order_id: order.razorpayOrderId, razorpay_payment_id: payment.id, razorpay_signature: 'a'.repeat(64) });
    expect(res.status).toBe(400);
    expect(await Entitlement.countDocuments()).toBe(0);
  });

  it('does not grant access when the captured amount differs from the order', async () => {
    const order = (await startCheckout()).body;
    const payment = gw.pay(order.razorpayOrderId, { amount: 100 });
    const res = await agent()
      .post('/api/v1/checkout/verify')
      .send({ razorpay_order_id: order.razorpayOrderId, razorpay_payment_id: payment.id, razorpay_signature: checkoutSignature(order.razorpayOrderId, payment.id) });
    expect(res.status).toBe(409);
    expect(await Entitlement.countDocuments()).toBe(0);
  });

  it('does not grant access for a payment that is not captured', async () => {
    const order = (await startCheckout()).body;
    const payment = gw.pay(order.razorpayOrderId, { status: 'failed' });
    const res = await agent()
      .post('/api/v1/checkout/verify')
      .send({ razorpay_order_id: order.razorpayOrderId, razorpay_payment_id: payment.id, razorpay_signature: checkoutSignature(order.razorpayOrderId, payment.id) });
    expect(res.status).toBe(409);
    expect((await Order.findOne())!.status).toBe('created');
  });

  it('fulfils once: paid order, entitlement and a single purchase email with an access link', async () => {
    const order = (await startCheckout()).body;
    const payment = gw.pay(order.razorpayOrderId);
    const body = {
      razorpay_order_id: order.razorpayOrderId,
      razorpay_payment_id: payment.id,
      razorpay_signature: checkoutSignature(order.razorpayOrderId, payment.id),
    };
    const first = await agent().post('/api/v1/checkout/verify').send(body);
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('paid');
    await agent().post('/api/v1/checkout/verify').send(body).expect(200);

    const saved = await Order.findOne({ orderNumber: order.orderNumber });
    expect(saved).toMatchObject({ status: 'paid', razorpay: { paymentId: payment.id } });
    expect(await Entitlement.countDocuments({ status: 'active' })).toBe(1);
    expect(purchaseEmails()).toHaveLength(1);
    expect(purchaseEmails()[0]!.text).toMatch(/\/auth\/magic\?token=/);
    expect(purchaseEmails()[0]!.html).not.toMatch(/\.pdf/i);

    // The emailed link signs the buyer in and lands on the book.
    const token = /token=([A-Za-z0-9_-]+)/.exec(purchaseEmails()[0]!.text)![1];
    const login = await agent().post('/api/v1/auth/magic-login').send({ token });
    expect(login.body.redirectTo).toBe('/read/deep-focus');
  });
});

describe('webhooks', () => {
  it('rejects bad signatures', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', 'deadbeef')
      .send(JSON.stringify({ event: 'payment.captured' }));
    expect(res.status).toBe(400);
    expect(await PaymentEvent.countDocuments()).toBe(0);
  });

  it('fulfils on payment.captured and ignores duplicate deliveries', async () => {
    const order = (await startCheckout()).body;
    const payment = gw.pay(order.razorpayOrderId);
    const payload = { payment: { entity: payment } };
    await sendWebhook('payment.captured', payload, 'evt_1').expect(200);
    const dup = await sendWebhook('payment.captured', payload, 'evt_1');
    expect(dup.body.duplicate).toBe(true);
    // A different event for the same payment (order.paid) is also harmless.
    await sendWebhook('order.paid', payload, 'evt_2').expect(200);

    expect((await Order.findOne())!.status).toBe('paid');
    expect(await Entitlement.countDocuments()).toBe(1);
    expect(purchaseEmails()).toHaveLength(1);
    expect(await PaymentEvent.countDocuments()).toBe(2);
  });

  it('webhook first, browser verify second: still one fulfilment', async () => {
    const order = (await startCheckout()).body;
    const payment = gw.pay(order.razorpayOrderId);
    await sendWebhook('payment.captured', { payment: { entity: payment } }).expect(200);
    const res = await agent()
      .post('/api/v1/checkout/verify')
      .send({ razorpay_order_id: order.razorpayOrderId, razorpay_payment_id: payment.id, razorpay_signature: checkoutSignature(order.razorpayOrderId, payment.id) });
    expect(res.body.status).toBe('paid');
    expect(purchaseEmails()).toHaveLength(1);
  });

  it('ignores captured events whose amount does not match', async () => {
    const order = (await startCheckout()).body;
    const payment = gw.pay(order.razorpayOrderId, { amount: 1 });
    await sendWebhook('payment.captured', { payment: { entity: payment } }).expect(200);
    expect((await Order.findOne())!.status).toBe('created');
    expect((await PaymentEvent.findOne())!.status).toBe('ignored');
  });

  it('records failures and still accepts a later successful retry', async () => {
    const order = (await startCheckout()).body;
    const failed = gw.pay(order.razorpayOrderId, { status: 'failed', error_description: 'Card declined' });
    await sendWebhook('payment.failed', { payment: { entity: failed } }).expect(200);
    expect((await Order.findOne())!).toMatchObject({ status: 'failed', failureReason: 'Card declined' });

    const ok = gw.pay(order.razorpayOrderId);
    await sendWebhook('payment.captured', { payment: { entity: ok } }).expect(200);
    expect((await Order.findOne())!.status).toBe('paid');
  });
});

describe('refunds, reconciliation and order history', () => {
  async function paidOrder() {
    const order = (await startCheckout()).body;
    const payment = gw.pay(order.razorpayOrderId);
    await sendWebhook('payment.captured', { payment: { entity: payment } }).expect(200);
    return { order, payment };
  }

  async function adminAgent() {
    await createUser({ email: 'boss@example.com', password: PASSWORD, roles: ['admin'] });
    const a = agent();
    await a.post('/api/v1/auth/login').send({ email: 'boss@example.com', password: PASSWORD, portal: 'admin' }).expect(200);
    return a;
  }

  it('full refund revokes access; duplicate refund webhooks are harmless', async () => {
    const { order } = await paidOrder();
    const admin = await adminAgent();
    const saved = await Order.findOne();
    const res = await admin.post(`/api/v1/admin/orders/${saved!._id}/refund`).send({ reason: 'Customer request' });
    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ status: 'refunded', refundedPaise: 79_900 });
    expect((await Entitlement.findOne())!.status).toBe('revoked');

    const refund = gw.refunds[0]!;
    await sendWebhook('refund.processed', { refund: { entity: refund } }).expect(200);
    const after = await Order.findOne({ orderNumber: order.orderNumber });
    expect(after!.refunds).toHaveLength(1);
    await admin.post(`/api/v1/admin/orders/${saved!._id}/refund`).send({ reason: 'again' }).expect(409);
  });

  it('partial refund keeps access', async () => {
    await paidOrder();
    const admin = await adminAgent();
    const saved = await Order.findOne();
    const res = await admin.post(`/api/v1/admin/orders/${saved!._id}/refund`).send({ amountPaise: 20_000, reason: 'Goodwill' });
    expect(res.body.order).toMatchObject({ status: 'partially_refunded', refundedPaise: 20_000 });
    expect((await Entitlement.findOne())!.status).toBe('active');
    await admin.post(`/api/v1/admin/orders/${saved!._id}/refund`).send({ amountPaise: 60_000, reason: 'Too much' }).expect(400);
  });

  it('reconciles an order whose callbacks never arrived', async () => {
    const order = (await startCheckout()).body;
    gw.pay(order.razorpayOrderId);
    const admin = await adminAgent();
    const saved = await Order.findOne();
    const res = await admin.post(`/api/v1/admin/orders/${saved!._id}/reconcile`);
    expect(res.body.result).toBe('fulfilled');
    expect((await Order.findOne())!.status).toBe('paid');
  });

  it('lists orders for the customer and exposes only masked data publicly', async () => {
    const { order } = await paidOrder();
    const status = await request(app).get(`/api/v1/checkout/orders/${order.orderNumber}`);
    expect(status.body).toMatchObject({ status: 'paid', maskedEmail: 'gu•••@example.com', isOwner: false });

    await User.updateOne({ email: 'guest@example.com' }, { $set: { passwordHash: await hashPassword(PASSWORD) } });
    const me = agent();
    await me.post('/api/v1/auth/login').send({ email: 'guest@example.com', password: PASSWORD }).expect(200);
    const orders = await me.get('/api/v1/me/orders');
    expect(orders.body.items).toHaveLength(1);
    expect(orders.body.items[0]).toMatchObject({ orderNumber: order.orderNumber, status: 'paid' });
  });
});
