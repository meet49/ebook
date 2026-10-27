import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setGateway } from '../src/lib/payments/gateway';
import { AffiliateProfile } from '../src/models/AffiliateProfile';
import { Commission } from '../src/models/Commission';
import { Coupon } from '../src/models/Coupon';
import { Order } from '../src/models/Order';
import { Product } from '../src/models/Product';
import { User } from '../src/models/User';
import { FakeGateway, webhookSignature } from './fake-gateway';
import { agent, app, createUser } from './helpers';

const PASSWORD = 'pass-word-1';
let gw: FakeGateway;
let n = 0;

beforeEach(async () => {
  gw = new FakeGateway();
  setGateway(gw);
  const base = { description: 'x', status: 'published' as const, publishedAt: new Date() };
  await Product.create([
    { ...base, slug: 'focus-basics', title: 'Focus Basics', categories: ['Productivity'], pricePaise: 20_000 },
    { ...base, slug: 'focus-advanced', title: 'Focus Advanced', categories: ['Productivity'], pricePaise: 14_900, comboPricePaise: 10_000 },
    { ...base, slug: 'money-101', title: 'Money 101', categories: ['Finance'], pricePaise: 9_900 },
  ]);
});

afterAll(() => setGateway(null));

const guest = (email = 'guest@example.com') => ({ name: 'Guest Buyer', email });
const order = (a: ReturnType<typeof agent>, productSlug: string, body: Record<string, unknown> = {}) =>
  a.post('/api/v1/checkout/orders').send({ productSlug, ...guest(), ...body });
const quote = (body: Record<string, unknown>) => request(app).post('/api/v1/checkout/quote').set('Origin', 'http://localhost:3000').send(body);

async function pay(razorpayOrderId: string) {
  const payment = gw.pay(razorpayOrderId);
  const payload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: payment } } });
  await request(app)
    .post('/api/v1/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', webhookSignature(payload))
    .set('X-Razorpay-Event-Id', `evt_${++n}`)
    .send(payload)
    .expect(200);
}

async function signIn(roles: ('customer' | 'admin' | 'affiliate')[]) {
  const email = `user${++n}@example.com`;
  const user = await createUser({ email, password: PASSWORD, roles });
  const a = agent();
  await a.post('/api/v1/auth/login').send({ email, password: PASSWORD, portal: roles.includes('admin') ? 'admin' : 'customer' }).expect(200);
  return { a, user };
}

async function createCoupon(admin: ReturnType<typeof agent>, body: Record<string, unknown>) {
  return admin.post('/api/v1/admin/coupons').send({ type: 'percent', percentOff: 10, ...body });
}

describe('admin coupons', () => {
  it('creates, lists, updates and deletes coupons', async () => {
    const { a: admin } = await signIn(['admin']);
    const created = await createCoupon(admin, { code: 'diwali20', percentOff: 20, description: 'Diwali sale' });
    expect(created.status).toBe(201);
    expect(created.body.coupon).toMatchObject({ code: 'DIWALI20', percentOff: 20, appliesTo: 'books', perUserLimit: 1, uses: 0, active: true });

    expect((await createCoupon(admin, { code: 'DIWALI20' })).status).toBe(409);
    expect((await createCoupon(admin, { code: 'FLAT50', type: 'fixed' })).status).toBe(400);
    expect((await createCoupon(admin, { code: 'PICK', appliesTo: 'selected', productIds: [] })).status).toBe(400);
    const badAffiliate = await createCoupon(admin, { code: 'RIYA10', affiliateCode: 'NOPE1234' });
    expect(badAffiliate.status).toBe(400);
    expect(badAffiliate.body.error.details.affiliateCode).toBeDefined();

    const id = created.body.coupon.id;
    const updated = await admin.put(`/api/v1/admin/coupons/${id}`).send({ code: 'DIWALI20', type: 'fixed', amountOffPaise: 5_000, active: false });
    expect(updated.status).toBe(200);
    expect(updated.body.coupon).toMatchObject({ type: 'fixed', amountOffPaise: 5_000, percentOff: null, active: false });

    const list = await admin.get('/api/v1/admin/coupons').expect(200);
    expect(list.body.items.map((c: { code: string }) => c.code)).toEqual(['DIWALI20']);

    await admin.delete(`/api/v1/admin/coupons/${id}`).expect(200);
    expect(await Coupon.countDocuments()).toBe(0);
  });

  it('keeps a used coupon and shows its uses', async () => {
    const { a: admin } = await signIn(['admin']);
    const { body } = await createCoupon(admin, { code: 'SAVE10' });
    const res = await order(agent(), 'focus-basics', { couponCode: 'save10' });
    await pay(res.body.razorpayOrderId);

    const del = await admin.delete(`/api/v1/admin/coupons/${body.coupon.id}`);
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe('COUPON_USED');
    const list = await admin.get('/api/v1/admin/coupons').expect(200);
    expect(list.body.items[0]).toMatchObject({ uses: 1, discountPaise: 2_000 });
  });

  it('is admin-only', async () => {
    const { a } = await signIn(['customer']);
    expect((await a.get('/api/v1/admin/coupons')).status).toBe(403);
  });
});

describe('coupons at checkout', () => {
  it('takes a percent off the order and counts a use only once it is paid', async () => {
    const { a: admin } = await signIn(['admin']);
    await createCoupon(admin, { code: 'SAVE10', perUserLimit: 1 });

    const q = await quote({ productSlug: 'focus-basics', couponCode: 'save10' }).expect(200);
    expect(q.body.quote).toMatchObject({ totalPaise: 18_000, coupon: { code: 'SAVE10', discountPaise: 2_000 }, couponError: null });

    const res = await order(agent(), 'focus-basics', { couponCode: 'SAVE10' });
    expect(res.status).toBe(201);
    expect(res.body.amountPaise).toBe(18_000);
    expect(gw.orders.get(res.body.razorpayOrderId)!.amount).toBe(18_000);
    expect(res.body.coupon).toEqual({ code: 'SAVE10', discountPaise: 2_000 });

    // An unpaid order does not use up the buyer's one use.
    const again = await order(agent(), 'focus-basics', { couponCode: 'SAVE10' });
    expect(again.status).toBe(201);
    await pay(again.body.razorpayOrderId);
    const paid = await Order.findOne({ orderNumber: again.body.orderNumber }).lean();
    expect(paid!.coupon).toMatchObject({ code: 'SAVE10', discountPaise: 2_000 });
    expect(paid!.items[0]).toMatchObject({ pricePaise: 18_000, couponDiscountPaise: 2_000 });

    // Now it is used: the same buyer cannot use it again, a new buyer can.
    const third = await order(agent(), 'money-101', { couponCode: 'SAVE10' });
    expect(third.status).toBe(400);
    expect(third.body.error.code).toBe('INVALID_COUPON');
    expect(third.body.error.details.couponCode).toEqual(['You have already used this coupon']);
    expect((await order(agent(), 'money-101', { ...guest('new@example.com'), couponCode: 'SAVE10' })).status).toBe(201);
  });

  it('spreads a fixed discount over the books in proportion to their price', async () => {
    const { a: admin } = await signIn(['admin']);
    await createCoupon(admin, { code: 'FLAT60', type: 'fixed', amountOffPaise: 6_000 });

    const res = await order(agent(), 'focus-basics', { addOnSlugs: ['focus-advanced'], couponCode: 'FLAT60' });
    expect(res.status).toBe(201);
    // ₹200 + ₹100 combo = ₹300, less ₹60: ₹40 off the first book and ₹20 off the second.
    expect(res.body.amountPaise).toBe(24_000);
    const saved = await Order.findOne({ orderNumber: res.body.orderNumber }).lean();
    expect(saved!.items.map((i) => [i.pricePaise, i.couponDiscountPaise])).toEqual([
      [16_000, 4_000],
      [8_000, 2_000],
    ]);
  });

  it('never takes a book below ₹1', async () => {
    const { a: admin } = await signIn(['admin']);
    await createCoupon(admin, { code: 'BIGOFF', type: 'fixed', amountOffPaise: 50_000 });
    const res = await order(agent(), 'money-101', { couponCode: 'BIGOFF' });
    expect(res.body.amountPaise).toBe(100);
  });

  it('checks scope, minimum order, dates, limits and on/off', async () => {
    const { a: admin } = await signIn(['admin']);
    const money = await Product.findOne({ slug: 'money-101' });
    await createCoupon(admin, { code: 'MONEYONLY', appliesTo: 'selected', productIds: [money!._id.toString()] });
    await createCoupon(admin, { code: 'MIN300', minOrderPaise: 30_000 });
    await createCoupon(admin, { code: 'OLD', endsAt: new Date(Date.now() - 60_000).toISOString() });
    await createCoupon(admin, { code: 'SOON', startsAt: new Date(Date.now() + 86_400_000).toISOString() });
    await createCoupon(admin, { code: 'OFF', active: false });
    await createCoupon(admin, { code: 'ONCE', maxRedemptions: 1, perUserLimit: null });
    await createCoupon(admin, { code: 'PASSONLY', appliesTo: 'membership' });

    const error = async (couponCode: string, productSlug = 'focus-basics') => (await quote({ productSlug, couponCode }).expect(200)).body.quote.couponError;
    expect(await error('MONEYONLY')).toBe('This coupon does not apply to these items');
    expect(await error('MONEYONLY', 'money-101')).toBeNull();
    expect(await error('MIN300')).toBe('This coupon needs an order of at least ₹300');
    expect(await error('OLD')).toBe('This coupon has expired');
    expect(await error('SOON')).toBe('This coupon is not active yet');
    expect(await error('OFF')).toBe('This coupon code is not valid');
    expect(await error('NOSUCHCODE')).toBe('This coupon code is not valid');
    expect(await error('PASSONLY')).toBe('This coupon does not apply to these items');

    // The quote still prices the order without the coupon; the order itself is refused.
    const q = await quote({ productSlug: 'focus-basics', couponCode: 'OLD' }).expect(200);
    expect(q.body.quote).toMatchObject({ totalPaise: 20_000, coupon: null });
    expect((await order(agent(), 'focus-basics', { couponCode: 'OLD' })).status).toBe(400);
    expect(await Order.countDocuments()).toBe(0);

    const first = await order(agent(), 'focus-basics', { couponCode: 'ONCE' });
    await pay(first.body.razorpayOrderId);
    expect(await error('ONCE', 'money-101')).toBe('This coupon has been fully used');
  });
});

describe('affiliate coupons', () => {
  it('credits the affiliate for sales with their coupon, on the discounted price', async () => {
    const { a: admin } = await signIn(['admin']);
    const { a: aff, user } = await signIn(['customer', 'affiliate']);
    const profile = await AffiliateProfile.create({ userId: user._id, code: 'RIYA2024', status: 'approved' });
    const created = await createCoupon(admin, { code: 'RIYA10', affiliateCode: 'riya2024' });
    expect(created.body.coupon.affiliateCode).toBe('RIYA2024');

    const mine = await aff.get('/api/v1/affiliate/coupons').expect(200);
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0]).toMatchObject({ code: 'RIYA10', percentOff: 10 });
    expect(mine.body.items[0].url).toContain('/ebooks?coupon=RIYA10');

    // No link click: the coupon alone credits the affiliate. 20% of ₹180 = ₹36.
    const res = await order(agent(), 'focus-basics', { ...guest('buyer@example.com'), couponCode: 'RIYA10' });
    await pay(res.body.razorpayOrderId);
    const commission = await Commission.findOne();
    expect(commission).toMatchObject({ affiliateId: profile._id, amountPaise: 3_600 });

    // The affiliate does not earn on their own coupon.
    const self = await order(aff, 'money-101', { couponCode: 'RIYA10' });
    await pay(self.body.razorpayOrderId);
    expect(await Commission.countDocuments()).toBe(1);
    expect((await User.findById(user._id))!.roles).toContain('affiliate');
  });
});
