import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setGateway } from '../src/lib/payments/gateway';
import { AffiliateClick } from '../src/models/AffiliateClick';
import { AffiliateProfile } from '../src/models/AffiliateProfile';
import { Commission } from '../src/models/Commission';
import { Order } from '../src/models/Order';
import { Payout } from '../src/models/Payout';
import { Product } from '../src/models/Product';
import { User } from '../src/models/User';
import { FakeGateway, webhookSignature } from './fake-gateway';
import { agent, app, createUser } from './helpers';

const PASSWORD = 'pass-word-1';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36';
let gw: FakeGateway;
let n = 0;

const APPLICATION = {
  website: 'https://example.com',
  channels: ['YouTube'],
  audienceSize: '1,000 – 10,000',
  promotionPlan: 'I review productivity books on my channel every week.',
  acceptTerms: true,
};

async function signIn(email: string, portal: 'customer' | 'affiliate' | 'admin', roles: ('customer' | 'affiliate' | 'admin')[]) {
  await createUser({ email, password: PASSWORD, roles });
  const a = agent().set('User-Agent', BROWSER_UA);
  await a.post('/api/v1/auth/login').send({ email, password: PASSWORD, portal }).expect(200);
  return a;
}

/** Applies as a visitor, gets approved by an admin, and creates a link for the book. */
async function approvedAffiliate() {
  const email = `aff${++n}@example.com`;
  const aff = agent().set('User-Agent', BROWSER_UA);
  await aff.post('/api/v1/affiliate/apply').send({ ...APPLICATION, name: 'Ava Affiliate', email, password: PASSWORD }).expect(201);
  const admin = await signIn(`admin${++n}@example.com`, 'admin', ['admin']);
  const profile = await AffiliateProfile.findOne().sort({ createdAt: -1 });
  await admin.post(`/api/v1/admin/affiliates/${profile!._id}/approve`).send({}).expect(200);
  const products = await aff.get('/api/v1/affiliate/products').expect(200);
  const link = await aff.post('/api/v1/affiliate/links').send({ productId: products.body.items[0].productId }).expect(201);
  return { aff, admin, profile: profile!, code: link.body.link.code as string, email };
}

async function buyAs(buyer: ReturnType<typeof agent>, body: Record<string, unknown> = {}) {
  const res = await buyer.post('/api/v1/checkout/orders').send({ productSlug: 'focus', ...body });
  expect(res.status).toBe(201);
  const payment = gw.pay(res.body.razorpayOrderId);
  const payload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: payment } } });
  await request(app).post('/api/v1/webhooks/razorpay').set('Content-Type', 'application/json').set('X-Razorpay-Signature', webhookSignature(payload)).send(payload).expect(200);
  return Order.findOne({ orderNumber: res.body.orderNumber });
}

beforeEach(async () => {
  gw = new FakeGateway();
  setGateway(gw);
  await Product.create({
    slug: 'focus',
    title: 'Focus',
    description: 'x',
    pricePaise: 100_000,
    status: 'published',
    publishedAt: new Date(),
    affiliate: { enabled: true, type: 'percent', value: 2000 },
  });
});

afterAll(() => setGateway(null));

describe('applications', () => {
  it('lets visitors apply, keeps them pending, and gates the dashboard until approval', async () => {
    const a = agent();
    const res = await a.post('/api/v1/affiliate/apply').send({ ...APPLICATION, name: 'Ava', email: 'ava@example.com', password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.profile).toMatchObject({ status: 'pending' });
    expect((await a.get('/api/v1/auth/me')).body.user.roles).toContain('affiliate');
    await a.get('/api/v1/affiliate/products').expect(403);

    const dup = await a.post('/api/v1/affiliate/apply').send(APPLICATION);
    expect(dup.status).toBe(409);
  });

  it('validates applications and only admins can decide', async () => {
    const bad = await agent().post('/api/v1/affiliate/apply').send({ ...APPLICATION, promotionPlan: 'short', name: 'A', email: 'x@example.com', password: PASSWORD });
    expect(bad.status).toBe(400);
    const customer = await signIn('c@example.com', 'customer', ['customer']);
    await customer.post('/api/v1/affiliate/apply').send(APPLICATION).expect(201);
    const profile = await AffiliateProfile.findOne();
    await customer.post(`/api/v1/admin/affiliates/${profile!._id}/approve`).send({}).expect(403);
  });
});

describe('referral links and attribution', () => {
  it('records the click, sets a signed referral cookie and redirects to the book', async () => {
    const { code } = await approvedAffiliate();
    const visitor = agent().set('User-Agent', BROWSER_UA);
    const res = await visitor.get(`/api/v1/r/${code}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/ebooks/focus');
    expect(String(res.headers['set-cookie'])).toMatch(/ebook_ref=[^;]+\.[a-f0-9]{32}; .*HttpOnly/);
    expect(await AffiliateClick.countDocuments()).toBe(1);

    // Re-clicking soon after does not inflate the count.
    await visitor.get(`/api/v1/r/${code}`).expect(302);
    expect(await AffiliateClick.countDocuments()).toBe(1);
  });

  it('does not count link-preview bots or unknown codes', async () => {
    const { code } = await approvedAffiliate();
    await agent().set('User-Agent', 'WhatsApp/2.23').get(`/api/v1/r/${code}`).expect(302);
    const unknown = await agent().set('User-Agent', BROWSER_UA).get('/api/v1/r/NOPE1234');
    expect(unknown.headers.location).toBe('/ebooks');
    expect(await AffiliateClick.countDocuments()).toBe(0);
  });

  it('attributes a purchase and books the documented 20% commission (₹1,000 → ₹200)', async () => {
    const { code, profile } = await approvedAffiliate();
    const visitor = agent().set('User-Agent', BROWSER_UA);
    await visitor.get(`/api/v1/r/${code}`).expect(302);
    const order = await buyAs(visitor, { name: 'Buyer', email: 'buyer@example.com' });

    expect(order!.attribution).toMatchObject({ type: 'affiliate' });
    expect(order!.attribution!.affiliateId!.equals(profile._id)).toBe(true);
    const commission = await Commission.findOne({ orderId: order!._id });
    expect(commission).toMatchObject({ baseAmountPaise: 100_000, amountPaise: 20_000, status: 'pending' });
    expect((await AffiliateClick.findOne())!.convertedOrderId!.equals(order!._id)).toBe(true);
  });

  it('records direct sales without a referral, and ignores tampered cookies', async () => {
    await approvedAffiliate();
    const direct = await buyAs(agent(), { name: 'Dee Direct', email: 'direct@example.com' });
    expect(direct!.attribution!.type).toBe('direct');

    const forged = agent().set('Cookie', `ebook_ref=${'a'.repeat(24)}.${'0'.repeat(32)}`);
    const order = await buyAs(forged, { name: 'Fay Forged', email: 'forged@example.com' });
    expect(order!.attribution!.type).toBe('direct');
    expect(await Commission.countDocuments()).toBe(0);
  });

  it('ignores clicks outside the attribution window', async () => {
    const { code } = await approvedAffiliate();
    const visitor = agent().set('User-Agent', BROWSER_UA);
    await visitor.get(`/api/v1/r/${code}`).expect(302);
    // createdAt is immutable through Mongoose, so backdate via the raw collection.
    await AffiliateClick.collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 31 * 86_400_000) } });
    const order = await buyAs(visitor, { name: 'Late', email: 'late@example.com' });
    expect(order!.attribution!.type).toBe('direct');
  });

  it('blocks self-referrals', async () => {
    const { aff, code } = await approvedAffiliate();
    await aff.get(`/api/v1/r/${code}`).expect(302);
    expect(await AffiliateClick.countDocuments()).toBe(0);
    const order = await buyAs(aff);
    expect(order!.attribution!.type).toBe('direct');
  });

  it('carries attribution across sign-in to the account', async () => {
    const { code } = await approvedAffiliate();
    await createUser({ email: 'returning@example.com', password: PASSWORD });
    const browser = agent().set('User-Agent', BROWSER_UA);
    await browser.get(`/api/v1/r/${code}`).expect(302);
    await browser.post('/api/v1/auth/login').send({ email: 'returning@example.com', password: PASSWORD }).expect(200);

    // Purchase from a different device (no cookie) still credits the affiliate.
    const otherDevice = agent();
    await otherDevice.post('/api/v1/auth/login').send({ email: 'returning@example.com', password: PASSWORD }).expect(200);
    const order = await buyAs(otherDevice);
    expect(order!.attribution!.type).toBe('affiliate');
  });

  it('suspended affiliates stop earning', async () => {
    const { code, admin, profile } = await approvedAffiliate();
    const visitor = agent().set('User-Agent', BROWSER_UA);
    await visitor.get(`/api/v1/r/${code}`).expect(302);
    await admin.post(`/api/v1/admin/affiliates/${profile._id}/suspend`).send({ note: 'Spam' }).expect(200);
    const order = await buyAs(visitor, { name: 'Bea Buyer', email: 'b2@example.com' });
    expect(order!.attribution!.type).toBe('direct');
  });
});

describe('commission lifecycle and payouts', () => {
  async function earnedCommission() {
    const setup = await approvedAffiliate();
    const visitor = agent().set('User-Agent', BROWSER_UA);
    await visitor.get(`/api/v1/r/${setup.code}`).expect(302);
    const order = await buyAs(visitor, { name: 'Buyer', email: `buyer${++n}@example.com` });
    return { ...setup, order: order! };
  }

  it('refund before payout reverses the commission', async () => {
    const { admin, order } = await earnedCommission();
    await admin.post(`/api/v1/admin/orders/${order._id}/refund`).send({ reason: 'Requested' }).expect(200);
    expect((await Commission.findOne())!.status).toBe('reversed');
  });

  it('goes pending → approved → payable → processing → paid, only with a real reference', async () => {
    const { aff, admin } = await earnedCommission();
    const c = await Commission.findOne();

    // Approval alone does not make it payable while the refund hold is running.
    await admin.post('/api/v1/admin/commissions/approve').send({ ids: [c!._id.toString()] }).expect(200);
    expect((await Commission.findById(c!._id))!.status).toBe('approved');

    await Commission.updateOne({ _id: c!._id }, { $set: { holdUntil: new Date(Date.now() - 1000) } });
    let payouts = await aff.get('/api/v1/affiliate/payouts').expect(200);
    expect(payouts.body).toMatchObject({ payablePaise: 20_000, hasPayoutDetails: false });

    await aff.post('/api/v1/affiliate/payouts').send({}).expect(400); // no payout details yet
    await aff.put('/api/v1/affiliate/me/payout').send({ method: 'bank_transfer', accountName: 'Ava A', accountNumber: '123456789012', ifsc: 'HDFC0001234' }).expect(200);
    const stored = await AffiliateProfile.findOne().select('+payoutDetails.accountNumberEnc');
    expect(stored!.payoutDetails!.accountNumberEnc).not.toContain('123456789012');

    const requested = await aff.post('/api/v1/affiliate/payouts').send({ note: 'Thanks' });
    expect(requested.status).toBe(201);
    expect(requested.body.payout).toMatchObject({ amountPaise: 20_000, status: 'requested', destination: 'Bank Ava A ••••9012 HDFC0001234' });
    expect((await Commission.findById(c!._id))!.status).toBe('processing');
    await aff.post('/api/v1/affiliate/payouts').send({}).expect(409);

    const dest = await admin.get(`/api/v1/admin/payouts/${requested.body.payout.id}/destination`).expect(200);
    expect(dest.body.accountNumber).toBe('123456789012');

    await admin.post(`/api/v1/admin/payouts/${requested.body.payout.id}/mark-paid`).send({ reference: '' }).expect(400);
    await admin.post(`/api/v1/admin/payouts/${requested.body.payout.id}/mark-paid`).send({ reference: 'UTR123456789' }).expect(200);
    const paid = await Commission.findById(c!._id);
    expect(paid!.status).toBe('paid');
    expect(paid!.history.map((h) => h.status)).toEqual(['pending', 'approved', 'payable', 'processing', 'paid']);

    payouts = await aff.get('/api/v1/affiliate/payouts');
    expect(payouts.body.items[0]).toMatchObject({ status: 'paid', reference: 'UTR123456789' });
  });

  it('rejecting a payout returns commissions to payable; refunds after payment flag a clawback', async () => {
    const { aff, admin, order } = await earnedCommission();
    const c = await Commission.findOne();
    await admin.post('/api/v1/admin/commissions/approve').send({ ids: [c!._id.toString()] });
    await Commission.updateOne({ _id: c!._id }, { $set: { holdUntil: new Date(0) } });
    await aff.put('/api/v1/affiliate/me/payout').send({ method: 'upi', upiId: 'ava@okbank' }).expect(200);
    const p = (await aff.post('/api/v1/affiliate/payouts').send({})).body.payout;

    await admin.post(`/api/v1/admin/payouts/${p.id}/reject`).send({ note: 'Verify identity' }).expect(200);
    expect((await Commission.findById(c!._id))!.status).toBe('payable');

    const p2 = (await aff.post('/api/v1/affiliate/payouts').send({})).body.payout;
    await admin.post(`/api/v1/admin/payouts/${p2.id}/mark-paid`).send({ reference: 'UPI-REF-9988' }).expect(200);
    await admin.post(`/api/v1/admin/orders/${order._id}/refund`).send({ reason: 'Late refund' }).expect(200);
    const after = await Commission.findById(c!._id);
    expect(after).toMatchObject({ status: 'paid', clawbackRequired: true });
  });

  it('enforces the minimum payout', async () => {
    await Product.updateOne({ slug: 'focus' }, { $set: { 'affiliate.value': 100 } }); // 1% → ₹10
    const { aff, admin } = await earnedCommission();
    const c = await Commission.findOne();
    await admin.post('/api/v1/admin/commissions/approve').send({ ids: [c!._id.toString()] });
    await Commission.updateOne({ _id: c!._id }, { $set: { holdUntil: new Date(0) } });
    await aff.put('/api/v1/affiliate/me/payout').send({ method: 'upi', upiId: 'ava@okbank' });
    const res = await aff.post('/api/v1/affiliate/payouts').send({});
    expect(res.status).toBe(400);
    expect((await Commission.findById(c!._id))!.status).toBe('payable');
  });

  it('reports stats to the affiliate and the admin', async () => {
    const { aff, admin } = await earnedCommission();
    const stats = await aff.get('/api/v1/affiliate/stats?days=7').expect(200);
    expect(stats.body).toMatchObject({ clicks: 1, uniqueVisitors: 1, sales: 1, conversionRate: 100 });
    expect(stats.body.earnings.pending.amountPaise).toBe(20_000);
    expect(stats.body.series).toHaveLength(7);

    const adminStats = await admin.get('/api/v1/admin/stats?days=7').expect(200);
    expect(adminStats.body.revenue).toMatchObject({ grossPaise: 100_000, netPaise: 100_000, orders: 1, affiliateOrders: 1 });
    const audit = await admin.get('/api/v1/admin/audit').expect(200);
    expect(audit.body.items.some((i: { action: string }) => i.action === 'order.paid')).toBe(true);
  });
});

describe('security regressions', () => {
  it('a guest checkout naming someone else cannot plant attribution on their account', async () => {
    const { code } = await approvedAffiliate();
    const victim = await createUser({ email: 'victim@example.com', password: PASSWORD });

    // Attacker (not signed in) clicks their own link, then starts a checkout using the victim's email.
    const attacker = agent().set('User-Agent', BROWSER_UA);
    await attacker.get(`/api/v1/r/${code}`).expect(302);
    await attacker.post('/api/v1/checkout/orders').send({ productSlug: 'focus', name: 'Victim', email: 'victim@example.com' }).expect(201);
    expect((await User.findById(victim._id))!.referral?.clickId ?? null).toBeNull();

    // The victim later buys on their own: the sale is direct, no commission.
    const own = agent();
    await own.post('/api/v1/auth/login').send({ email: 'victim@example.com', password: PASSWORD }).expect(200);
    await Order.deleteMany({});
    const order = await buyAs(own);
    expect(order!.attribution!.type).toBe('direct');
  });

  it('a refund during an open payout shrinks the payout and freezes nothing incorrectly', async () => {
    const { aff, admin, code } = await approvedAffiliate();
    const orders = [];
    for (const email of ['r1@example.com', 'r2@example.com']) {
      const visitor = agent().set('User-Agent', BROWSER_UA);
      await visitor.get(`/api/v1/r/${code}`).expect(302);
      orders.push(await buyAs(visitor, { name: 'Ref Buyer', email }));
    }
    const ids = (await Commission.find()).map((c) => c._id.toString());
    await admin.post('/api/v1/admin/commissions/approve').send({ ids });
    await Commission.updateMany({}, { $set: { holdUntil: new Date(0) } });
    await aff.put('/api/v1/affiliate/me/payout').send({ method: 'upi', upiId: 'ava@okbank' }).expect(200);
    const payout = (await aff.post('/api/v1/affiliate/payouts').send({})).body.payout;
    expect(payout.amountPaise).toBe(40_000);

    // Payout details are locked while the request is open; the admin sees the frozen destination.
    await aff.put('/api/v1/affiliate/me/payout').send({ method: 'upi', upiId: 'attacker@okbank' }).expect(409);
    expect((await admin.get(`/api/v1/admin/payouts/${payout.id}/destination`)).body.upiId).toBe('ava@okbank');

    await admin.post(`/api/v1/admin/orders/${orders[0]!._id}/refund`).send({ reason: 'Refund in flight' }).expect(200);
    const after = await Payout.findById(payout.id);
    expect(after!.amountPaise).toBe(20_000);
    expect(after!.commissionIds).toHaveLength(1);
    expect((await Commission.findOne({ orderId: orders[0]!._id }))!.status).toBe('reversed');

    await admin.post(`/api/v1/admin/orders/${orders[1]!._id}/refund`).send({ reason: 'Second refund' }).expect(200);
    await admin.post(`/api/v1/admin/payouts/${payout.id}/mark-paid`).send({ reference: 'UTR-ZERO-1' }).expect(409);
  });
});

describe('one-click join for buyers', () => {
  it('approves a buyer instantly and lets them create links', async () => {
    const buyer = await signIn(`buyer${++n}@example.com`, 'customer', ['customer']);
    // Not yet a buyer: refused.
    await buyer.post('/api/v1/affiliate/join').send({ acceptTerms: true }).expect(403);

    await buyAs(buyer);
    await buyer.post('/api/v1/affiliate/join').send({}).expect(400);
    const res = await buyer.post('/api/v1/affiliate/join').send({ acceptTerms: true }).expect(200);
    expect(res.body.profile.status).toBe('approved');

    const product = await Product.findOne({ slug: 'focus' });
    const link = await buyer.post('/api/v1/affiliate/links').send({ productId: product!._id.toString() }).expect(201);
    expect(link.body.link.url).toMatch(/\/r\//);
    // Joining again is harmless.
    await buyer.post('/api/v1/affiliate/join').send({ acceptTerms: true }).expect(200);
    expect(await AffiliateProfile.countDocuments({ status: 'approved' })).toBe(1);
  });

  it('never re-activates a suspended affiliate', async () => {
    const buyer = await signIn(`buyer${++n}@example.com`, 'customer', ['customer']);
    await buyAs(buyer);
    await buyer.post('/api/v1/affiliate/join').send({ acceptTerms: true }).expect(200);
    await AffiliateProfile.updateOne({}, { $set: { status: 'suspended' } });
    await buyer.post('/api/v1/affiliate/join').send({ acceptTerms: true }).expect(403);
  });
});
