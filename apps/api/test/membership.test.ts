import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { setGateway } from '../src/lib/payments/gateway';
import { Entitlement } from '../src/models/Entitlement';
import { MembershipPass } from '../src/models/MembershipPass';
import { Order } from '../src/models/Order';
import { Product } from '../src/models/Product';
import { FakeGateway, webhookSignature } from './fake-gateway';
import { agent, app, createUser } from './helpers';

const PASSWORD = 'pass-word-1';
const DAY = 86_400_000;
let gw: FakeGateway;
let n = 0;

beforeEach(async () => {
  gw = new FakeGateway();
  setGateway(gw);
  const book = { description: 'x', status: 'published' as const, publishedAt: new Date(), pageCount: 10, pageSetId: new Types.ObjectId() };
  await Product.create([
    { ...book, slug: 'focus-basics', title: 'Focus Basics', categories: ['Productivity'], pricePaise: 19_900 },
    { ...book, slug: 'money-101', title: 'Money 101', categories: ['Finance'], pricePaise: 14_900 },
    { ...book, slug: 'not-in-pass', title: 'Not In Pass', categories: ['Finance'], pricePaise: 9_900, includedInMembership: false },
    { ...book, slug: 'old-book', title: 'Old Book', categories: ['Finance'], pricePaise: 9_900, status: 'unpublished' as const },
  ]);
});

afterAll(() => setGateway(null));

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
  const user = await createUser({ email, password: PASSWORD, roles });
  const a = agent();
  await a.post('/api/v1/auth/login').send({ email, password: PASSWORD, portal: roles.includes('admin') ? 'admin' : 'customer' }).expect(200);
  return { a, user };
}

async function publishedPlan(body: Record<string, unknown> = {}) {
  const { a: admin } = await signIn(['admin']);
  const created = await admin.post('/api/v1/admin/membership/plans').send({ title: 'Monthly', durationDays: 30, pricePaise: 29_900, ...body });
  expect(created.status).toBe(201);
  await admin.post(`/api/v1/admin/membership/plans/${created.body.plan.id}/publish`).expect(200);
  return { admin, plan: created.body.plan as { id: string; slug: string } };
}

async function buyPass(a: ReturnType<typeof agent>, slug: string) {
  const res = await a.post('/api/v1/checkout/orders').send({ productSlug: slug });
  expect(res.status).toBe(201);
  await pay(res.body.razorpayOrderId);
  return res.body as { orderNumber: string; amountPaise: number };
}

const progress = (a: ReturnType<typeof agent>, productId: string) => a.put(`/api/v1/me/progress/${productId}`).send({ page: 2 });
const idOf = async (slug: string) => (await Product.findOne({ slug }))!._id.toString();

describe('membership plans', () => {
  it('are managed by the admin and shown on the membership page, not in the catalogue', async () => {
    const { admin, plan } = await publishedPlan({ benefits: ['Every eBook'], featured: true });
    expect(plan.slug).toBe('monthly-pass');

    const page = await request(app).get('/api/v1/membership').expect(200);
    expect(page.body.plans).toEqual([expect.objectContaining({ title: 'Monthly', durationDays: 30, effectivePricePaise: 29_900, featured: true })]);
    // Published and included: Focus Basics and Money 101.
    expect(page.body.bookCount).toBe(2);

    const catalogue = await request(app).get('/api/v1/products').expect(200);
    expect(catalogue.body.items.map((p: { slug: string }) => p.slug)).not.toContain('monthly-pass');
    const detail = await request(app).get('/api/v1/products/monthly-pass').expect(200);
    expect(detail.body.product).toMatchObject({ kind: 'membership', membershipDays: 30 });

    const list = await admin.get('/api/v1/admin/membership/plans').expect(200);
    expect(list.body).toMatchObject({ members: 0, items: [expect.objectContaining({ status: 'published', sold: 0 })] });
    const books = await admin.get('/api/v1/admin/products').expect(200);
    expect(books.body.items.map((p: { slug: string }) => p.slug)).not.toContain('monthly-pass');

    await admin.post(`/api/v1/admin/membership/plans/${plan.id}/unpublish`).expect(200);
    expect((await request(app).get('/api/v1/membership')).body.plans).toEqual([]);
    await admin.delete(`/api/v1/admin/membership/plans/${plan.id}`).expect(200);
    expect(await Product.exists({ _id: plan.id })).toBeNull();
  });

  it('validates plans', async () => {
    const { a: admin } = await signIn(['admin']);
    const res = await admin.post('/api/v1/admin/membership/plans').send({ title: 'Bad', durationDays: 0, pricePaise: 29_900, salePricePaise: 39_900 });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details)).toEqual(expect.arrayContaining(['durationDays', 'salePricePaise']));
  });
});

describe('membership access', () => {
  it('opens every included, published book while the pass runs', async () => {
    const { plan } = await publishedPlan();
    const { a, user } = await signIn(['customer']);
    expect((await progress(a, await idOf('focus-basics'))).status).toBe(403);

    await buyPass(a, plan.slug);
    expect(await Entitlement.countDocuments()).toBe(0);
    const pass = await MembershipPass.findOne({ userId: user._id });
    expect(pass).toMatchObject({ days: 30, status: 'active' });

    await progress(a, await idOf('focus-basics')).expect(200);
    await a.get('/api/v1/reader/by-slug/money-101').expect(200);
    expect((await progress(a, await idOf('not-in-pass'))).status).toBe(403);
    expect((await progress(a, await idOf('old-book'))).status).toBe(403);

    const library = await a.get('/api/v1/me/library').expect(200);
    expect(library.body.items).toEqual([]);
    expect(library.body.membership.endsAt).toBeTruthy();
    // Most recently opened first.
    expect(library.body.membershipItems.map((b: { slug: string }) => b.slug)).toEqual(['money-101', 'focus-basics']);
    expect(library.body.explore.map((b: { slug: string }) => b.slug)).toEqual(['not-in-pass']);

    // Once it runs out, access ends.
    await MembershipPass.updateMany({}, { $set: { grantedAt: new Date(Date.now() - 31 * DAY) } });
    expect((await progress(a, await idOf('focus-basics'))).status).toBe(403);
    expect((await a.get('/api/v1/me/library')).body).toMatchObject({ membership: null, membershipItems: [] });
  });

  it('stacks a second pass after the first and can be bought again', async () => {
    const { plan } = await publishedPlan();
    const { a } = await signIn(['customer']);
    await buyPass(a, plan.slug);
    const first = (await a.get('/api/v1/me/library')).body.membership.endsAt;
    await buyPass(a, plan.slug);
    const second = (await a.get('/api/v1/me/library')).body.membership.endsAt;
    expect(new Date(second).getTime() - new Date(first).getTime()).toBeGreaterThan(29.9 * DAY);
  });

  it('keeps bought books after the pass and revokes the pass on a full refund', async () => {
    const { admin, plan } = await publishedPlan();
    const { a } = await signIn(['customer']);
    const bought = await a.post('/api/v1/checkout/orders').send({ productSlug: 'money-101' });
    await pay(bought.body.razorpayOrderId);
    const pass = await buyPass(a, plan.slug);

    const order = await Order.findOne({ orderNumber: pass.orderNumber });
    expect(order!.items[0]).toMatchObject({ membershipDays: 30 });
    await admin.post(`/api/v1/admin/orders/${order!._id}/refund`).send({ reason: 'Changed mind' }).expect(200);

    expect(await MembershipPass.findOne({ orderId: order!._id })).toMatchObject({ status: 'revoked' });
    expect((await progress(a, await idOf('focus-basics'))).status).toBe(403);
    await progress(a, await idOf('money-101')).expect(200);

    // A sold plan is archived, not deleted.
    const del = await admin.delete(`/api/v1/admin/membership/plans/${plan.id}`).expect(200);
    expect(del.body.archived).toBe(true);
  });

  it('applies membership coupons to plans only', async () => {
    const { admin, plan } = await publishedPlan();
    await admin.post('/api/v1/admin/coupons').send({ code: 'PASS50', type: 'percent', percentOff: 50, appliesTo: 'membership' }).expect(201);
    await admin.post('/api/v1/admin/coupons').send({ code: 'BOOKS10', type: 'percent', percentOff: 10 }).expect(201);
    const quote = (body: Record<string, unknown>) => request(app).post('/api/v1/checkout/quote').set('Origin', 'http://localhost:3000').send(body);

    expect((await quote({ productSlug: plan.slug, couponCode: 'PASS50' })).body.quote.totalPaise).toBe(14_950);
    expect((await quote({ productSlug: plan.slug, couponCode: 'BOOKS10' })).body.quote.couponError).toBe('This coupon does not apply to these items');
    expect((await quote({ productSlug: 'money-101', couponCode: 'PASS50' })).body.quote.couponError).toBe('This coupon does not apply to these items');
  });
});
