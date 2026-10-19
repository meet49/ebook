import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { devOutbox } from '../src/lib/email/transport';
import { setGateway } from '../src/lib/payments/gateway';
import { AffiliateProfile } from '../src/models/AffiliateProfile';
import { Commission } from '../src/models/Commission';
import { Entitlement } from '../src/models/Entitlement';
import { Order } from '../src/models/Order';
import { Product } from '../src/models/Product';
import { User } from '../src/models/User';
import { FakeGateway, webhookSignature } from './fake-gateway';
import { agent, app, createUser } from './helpers';

const PASSWORD = 'pass-word-1';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36';
let gw: FakeGateway;
let n = 0;

beforeEach(async () => {
  gw = new FakeGateway();
  setGateway(gw);
  const base = { description: 'x', status: 'published' as const, publishedAt: new Date() };
  await Product.create([
    { ...base, slug: 'focus-basics', title: 'Focus Basics', categories: ['Productivity'], pricePaise: 14_900 },
    {
      ...base,
      slug: 'focus-advanced',
      title: 'Focus Advanced',
      categories: ['Productivity'],
      pricePaise: 14_900,
      comboPricePaise: 9_900,
      affiliate: { enabled: false, type: 'percent' as const, value: 2000 },
    },
    { ...base, slug: 'money-101', title: 'Money 101', categories: ['Finance'], pricePaise: 19_900, comboPricePaise: 12_900 },
  ]);
});

afterAll(() => setGateway(null));

const guest = (email = 'guest@example.com') => ({ name: 'Guest Buyer', email });

function order(a: ReturnType<typeof agent>, productSlug: string, body: Record<string, unknown> = {}) {
  return a.post('/api/v1/checkout/orders').send({ productSlug, ...body });
}

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

async function signIn(roles: ('customer' | 'admin')[]) {
  const email = `user${++n}@example.com`;
  await createUser({ email, password: PASSWORD, roles });
  const a = agent();
  await a.post('/api/v1/auth/login').send({ email, password: PASSWORD, portal: roles.includes('admin') ? 'admin' : 'customer' }).expect(200);
  return { a, email };
}

describe('buying books together', () => {
  it('adds a same-category book at its combo price in one payment', async () => {
    const res = await order(agent(), 'focus-basics', { ...guest(), addOnSlugs: ['focus-advanced'] });
    expect(res.status).toBe(201);
    expect(res.body.amountPaise).toBe(14_900 + 9_900);
    expect(gw.orders.get(res.body.razorpayOrderId)!.amount).toBe(24_800);
    expect(res.body.lines).toEqual([
      { title: 'Focus Basics', slug: 'focus-basics', listPricePaise: 14_900, pricePaise: 14_900, combo: false },
      { title: 'Focus Advanced', slug: 'focus-advanced', listPricePaise: 14_900, pricePaise: 9_900, combo: true },
    ]);

    await pay(res.body.razorpayOrderId);
    expect(await Entitlement.countDocuments({ status: 'active' })).toBe(2);
    const email = devOutbox.find((m) => m.subject.startsWith('Your eBook is ready'))!;
    expect(email.text).toContain('Focus Basics + Focus Advanced');

    // A combo opens the library, where both books are.
    const token = /token=([A-Za-z0-9_-]+)/.exec(email.text)![1];
    const login = await agent().post('/api/v1/auth/magic-login').send({ token });
    expect(login.body.redirectTo).toBe('/library');
  });

  it('rejects add-ons from another category or without a combo price', async () => {
    const otherCategory = await order(agent(), 'focus-basics', { ...guest(), addOnSlugs: ['money-101'] });
    expect(otherCategory.status).toBe(400);
    expect(otherCategory.body.error.details.addOnSlugs).toEqual(['money-101']);

    const noCombo = await order(agent(), 'focus-advanced', { ...guest(), addOnSlugs: ['focus-basics'] });
    expect(noCombo.status).toBe(400);
    expect(await Order.countDocuments()).toBe(0);
  });

  it('refuses an add-on the buyer already owns', async () => {
    const first = await order(agent(), 'focus-advanced', guest());
    await pay(first.body.razorpayOrderId);

    const again = await order(agent(), 'focus-basics', { ...guest(), addOnSlugs: ['focus-advanced'] });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_OWNED');
  });

  it('shows the books that can be added on the product page and in the quote', async () => {
    const detail = await request(app).get('/api/v1/products/focus-basics').expect(200);
    expect(detail.body.product.addOns.map((p: { slug: string; comboPricePaise: number }) => [p.slug, p.comboPricePaise])).toEqual([['focus-advanced', 9_900]]);

    // Focus Basics has no combo price, so it is never offered as an add-on.
    const advanced = await request(app).get('/api/v1/products/focus-advanced').expect(200);
    expect(advanced.body.product.addOns).toEqual([]);

    const quote = await request(app).post('/api/v1/checkout/quote').set('Origin', 'http://localhost:3000').send({ productSlug: 'focus-basics', addOnSlugs: ['focus-advanced'] }).expect(200);
    expect(quote.body.quote).toMatchObject({ totalPaise: 24_800, savingsPaise: 5_000, offerExpiresAt: null });
    expect(quote.body.quote.addOns.map((p: { slug: string }) => p.slug)).toEqual(['focus-advanced']);
  });
});

describe('offers after a purchase', () => {
  it('gives the combo price for 24 hours after buying a same-category book', async () => {
    const { a } = await signIn(['customer']);
    const first = await order(a, 'focus-basics');
    await pay(first.body.razorpayOrderId);

    const offers = await a.get('/api/v1/me/offers').expect(200);
    expect(offers.body.offers.items.map((p: { slug: string }) => p.slug)).toEqual(['focus-advanced']);
    expect(offers.body.offers.expiresAt).not.toBeNull();

    const quote = await a.post('/api/v1/checkout/quote').send({ productSlug: 'focus-advanced' }).expect(200);
    expect(quote.body.quote.totalPaise).toBe(9_900);
    const second = await order(a, 'focus-advanced');
    expect(second.body.amountPaise).toBe(9_900);
    expect(second.body.lines[0].combo).toBe(true);

    // Once the window has passed, the normal price applies again.
    await Entitlement.updateMany({}, { $set: { grantedAt: new Date(Date.now() - 25 * 60 * 60_000) } });
    expect((await a.get('/api/v1/me/offers')).body.offers.items).toEqual([]);
    expect((await order(a, 'focus-advanced')).body.amountPaise).toBe(14_900);
  });

  it('shows a guest the offer from their order number', async () => {
    const first = await order(agent(), 'focus-basics', guest());
    await pay(first.body.razorpayOrderId);

    const offers = await request(app).get(`/api/v1/checkout/orders/${first.body.orderNumber}/offers`).expect(200);
    expect(offers.body.offers.items.map((p: { slug: string; comboPricePaise: number }) => [p.slug, p.comboPricePaise])).toEqual([['focus-advanced', 9_900]]);

    const post = (body: Record<string, unknown>) => request(app).post('/api/v1/checkout/quote').set('Origin', 'http://localhost:3000').send(body);
    expect((await post({ productSlug: 'focus-advanced', fromOrder: first.body.orderNumber })).body.quote.totalPaise).toBe(9_900);
    expect((await post({ productSlug: 'focus-advanced' })).body.quote.totalPaise).toBe(14_900);

    // Buying with the same email gets the combo price; a different email does not.
    expect((await order(agent(), 'focus-advanced', guest())).body.amountPaise).toBe(9_900);
    expect((await order(agent(), 'focus-advanced', guest('someone@example.com'))).body.amountPaise).toBe(14_900);
  });

  it('offers nothing for an unpaid order', async () => {
    const pending = await order(agent(), 'focus-basics', guest());
    const offers = await request(app).get(`/api/v1/checkout/orders/${pending.body.orderNumber}/offers`).expect(200);
    expect(offers.body.offers).toEqual({ expiresAt: null, items: [] });
  });
});

describe('combo commissions and refunds', () => {
  async function affiliateVisitor() {
    const email = `aff${++n}@example.com`;
    const aff = agent().set('User-Agent', BROWSER_UA);
    await aff
      .post('/api/v1/affiliate/apply')
      .send({
        website: 'https://example.com',
        channels: ['YouTube'],
        audienceSize: '1,000 – 10,000',
        promotionPlan: 'I review productivity books on my channel every week.',
        acceptTerms: true,
        name: 'Ava Affiliate',
        email,
        password: PASSWORD,
      })
      .expect(201);
    const { a: admin } = await signIn(['admin']);
    const profile = await AffiliateProfile.findOne({ userId: (await User.findOne({ email }))!._id });
    await admin.post(`/api/v1/admin/affiliates/${profile!._id}/approve`).send({}).expect(200);
    const basics = await Product.findOne({ slug: 'focus-basics' });
    const link = await aff.post('/api/v1/affiliate/links').send({ productId: basics!._id.toString() }).expect(201);
    const visitor = agent().set('User-Agent', BROWSER_UA);
    await visitor.get(`/api/v1/r/${link.body.link.code}`).expect(302);
    return { visitor, admin };
  }

  it('pays each book under its own rule, scales on partial refund and revokes every book on full refund', async () => {
    const { visitor, admin } = await affiliateVisitor();
    const res = await order(visitor, 'focus-basics', { ...guest('buyer@example.com'), addOnSlugs: ['focus-advanced'] });
    expect(res.status).toBe(201);
    await pay(res.body.razorpayOrderId);

    // 20% of Focus Basics (₹149); Focus Advanced pays no commission.
    const commission = await Commission.findOne();
    expect(commission!.amountPaise).toBe(2_980);
    expect(commission!.baseAmountPaise).toBe(24_800);

    const saved = await Order.findOne({ orderNumber: res.body.orderNumber });
    await admin.post(`/api/v1/admin/orders/${saved!._id}/refund`).send({ amountPaise: 12_400, reason: 'Half back' }).expect(200);
    expect((await Commission.findOne())!.amountPaise).toBe(1_490);
    expect(await Entitlement.countDocuments({ status: 'active' })).toBe(2);

    await admin.post(`/api/v1/admin/orders/${saved!._id}/refund`).send({ reason: 'Rest' }).expect(200);
    expect((await Commission.findOne())!.status).toBe('reversed');
    expect(await Entitlement.countDocuments({ status: 'revoked' })).toBe(2);
  });
});

describe('admin', () => {
  it('rejects a combo price that is not lower than the selling price', async () => {
    const { a } = await signIn(['admin']);
    const res = await a.post('/api/v1/admin/products').send({ title: 'Combo Test', pricePaise: 9_900, comboPricePaise: 9_900 });
    expect(res.status).toBe(400);
    expect(res.body.error.details.comboPricePaise).toBeDefined();
  });

  it('deletes a book nobody bought, but not one that was sold', async () => {
    const { a } = await signIn(['admin']);
    const draft = await a.post('/api/v1/admin/products').send({ title: 'Never Sold', pricePaise: 9_900 }).expect(201);
    await a.delete(`/api/v1/admin/products/${draft.body.product.id}`).expect(200);
    expect(await Product.exists({ _id: draft.body.product.id })).toBeNull();

    const sold = await order(agent(), 'money-101', guest());
    await pay(sold.body.razorpayOrderId);
    const money = await Product.findOne({ slug: 'money-101' });
    const res = await a.delete(`/api/v1/admin/products/${money!._id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HAS_SALES');
    await request(app).delete(`/api/v1/admin/products/${money!._id}`).set('Origin', 'http://localhost:3000').expect(401);
  });
});

describe('orders made before combos', () => {
  it('still show their book as a single line', async () => {
    const { a, email } = await signIn(['customer']);
    const user = await User.findOne({ email });
    const money = await Product.findOne({ slug: 'money-101' });
    await Order.collection.insertOne({
      orderNumber: 'EB-20250101-ABCDEF',
      userId: user!._id,
      productId: money!._id,
      productSnapshot: { title: 'Money 101', slug: 'money-101' },
      amountPaise: 19_900,
      currency: 'INR',
      status: 'paid',
      razorpay: { orderId: 'order_legacy' },
      refunds: [],
      refundedPaise: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await a.get('/api/v1/me/orders').expect(200);
    expect(res.body.items[0].lines).toEqual([{ title: 'Money 101', slug: 'money-101', listPricePaise: 19_900, pricePaise: 19_900, combo: false }]);
  });
});
