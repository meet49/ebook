import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { setGateway } from '../src/lib/payments/gateway';
import { AffiliateProfile } from '../src/models/AffiliateProfile';
import { AuthorEarning } from '../src/models/AuthorEarning';
import { AuthorProfile } from '../src/models/AuthorProfile';
import { Order } from '../src/models/Order';
import { Product } from '../src/models/Product';
import { FakeGateway, webhookSignature } from './fake-gateway';
import { agent, app, createUser } from './helpers';

const PASSWORD = 'pass-word-1';
let gw: FakeGateway;
let n = 0;

beforeEach(() => {
  gw = new FakeGateway();
  setGateway(gw);
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

async function signIn(roles: ('customer' | 'admin' | 'affiliate')[]) {
  const email = `user${++n}@example.com`;
  const user = await createUser({ email, password: PASSWORD, roles });
  const a = agent();
  await a.post('/api/v1/auth/login').send({ email, password: PASSWORD, portal: roles.includes('admin') ? 'admin' : 'customer' }).expect(200);
  return { a, user };
}

const application = {
  penName: 'Asha Rao',
  bio: 'Writes about money for first-time earners.',
  website: '',
  aboutBooks: 'Short practical guides on saving, budgeting and investing for young Indians.',
  acceptTerms: true,
};

/** A visitor applies (creating an account), and an admin approves them. */
async function approvedAuthor(sharePercent = 70) {
  const author = agent();
  const email = `author${++n}@example.com`;
  const applied = await author.post('/api/v1/author/apply').send({ ...application, name: 'Asha', email, password: PASSWORD });
  expect(applied.status).toBe(201);
  expect(applied.body.profile.status).toBe('pending');
  const { a: admin } = await signIn(['admin']);
  await admin.post(`/api/v1/admin/authors/${applied.body.profile.id}/approve`).send({ sharePercent }).expect(200);
  return { author, admin, profileId: applied.body.profile.id as string };
}

const book = { title: 'Save Your First Lakh', description: 'A practical guide.', pricePaise: 20_000, categories: ['Finance'] };

/** Stands in for uploading a cover and a PDF (covered by the product tests). */
const markFilesReady = (id: string) =>
  Product.updateOne({ _id: id }, { $set: { coverAssetId: new Types.ObjectId(), pageSetId: new Types.ObjectId(), pageCount: 40, 'processing.status': 'ready' } });

async function publishedAuthorBook(author: ReturnType<typeof agent>, admin: ReturnType<typeof agent>, extra: Record<string, unknown> = {}) {
  const created = await author.post('/api/v1/author/products').send({ ...book, ...extra });
  expect(created.status).toBe(201);
  const id = created.body.product.id as string;
  await markFilesReady(id);
  await author.post(`/api/v1/author/products/${id}/submit`).expect(200);
  await admin.post(`/api/v1/admin/products/${id}/publish`).expect(200);
  return id;
}

describe('author applications', () => {
  it('lets a visitor apply and an admin approve, reject or suspend', async () => {
    const author = agent();
    await author.post('/api/v1/author/apply').send({ ...application, name: 'Asha', email: 'asha@example.com', password: PASSWORD }).expect(201);
    // Pending authors cannot add books yet.
    expect((await author.post('/api/v1/author/products').send(book)).status).toBe(403);
    expect((await author.post('/api/v1/author/apply').send(application)).status).toBe(409);

    const { a: admin } = await signIn(['admin']);
    const list = await admin.get('/api/v1/admin/authors?status=pending').expect(200);
    expect(list.body.items).toEqual([expect.objectContaining({ penName: 'Asha Rao', sharePercent: 70, user: { name: 'Asha', email: 'asha@example.com' } })]);
    const id = list.body.items[0].id;

    await admin.post(`/api/v1/admin/authors/${id}/reject`).send({ note: 'Please send a sample chapter.' }).expect(200);
    expect((await author.get('/api/v1/author/me')).body.profile).toMatchObject({ status: 'rejected', reviewNote: 'Please send a sample chapter.' });
    // A rejected author can apply again.
    await author.post('/api/v1/author/apply').send(application).expect(201);
    await admin.post(`/api/v1/admin/authors/${id}/approve`).send({ sharePercent: 60 }).expect(200);
    expect((await author.get('/api/v1/author/me')).body.profile).toMatchObject({ status: 'approved', sharePercent: 60 });

    await admin.post(`/api/v1/admin/authors/${id}/suspend`).send({ note: 'Copied content' }).expect(200);
    expect((await author.post('/api/v1/author/products').send(book)).status).toBe(403);
  });

  it('is admin-only to manage authors', async () => {
    const { a } = await signIn(['customer']);
    expect((await a.get('/api/v1/admin/authors')).status).toBe(403);
    expect((await a.get('/api/v1/author/products')).status).toBe(403);
  });
});

describe('author books', () => {
  it('go through review before they reach the store', async () => {
    const { author, admin } = await approvedAuthor();
    const created = await author.post('/api/v1/author/products').send({ ...book, featured: true, includedInMembership: true, affiliate: { enabled: true, type: 'percent', value: 9000 } });
    expect(created.status).toBe(201);
    // Store settings stay with the admin; the pen name is the default author line.
    expect(created.body.product).toMatchObject({ status: 'draft', featured: false, includedInMembership: false, author: 'Asha Rao', affiliate: { value: 2000 } });
    expect(created.body.product.authorProfile.penName).toBe('Asha Rao');
    expect(created.body.product.coverUrl).toBeNull();
    const id = created.body.product.id;

    const notReady = await author.post(`/api/v1/author/products/${id}/submit`);
    expect(notReady.status).toBe(409);
    expect(notReady.body.error.details.publish.length).toBeGreaterThan(0);

    await markFilesReady(id);
    await author.post(`/api/v1/author/products/${id}/submit`).expect(200);
    expect((await author.put(`/api/v1/author/products/${id}`).send({ ...book, title: 'Changed' })).status).toBe(409);
    expect((await request(app).get(`/api/v1/products/${(await Product.findById(id))!.slug}`)).status).toBe(404);

    const inReview = await admin.get('/api/v1/admin/products?status=in_review').expect(200);
    expect(inReview.body.items.map((p: { id: string }) => p.id)).toEqual([id]);
    await admin.post(`/api/v1/admin/products/${id}/request-changes`).send({ note: 'Add a table of contents.' }).expect(200);
    const back = await author.get(`/api/v1/author/products/${id}`).expect(200);
    expect(back.body.product).toMatchObject({ status: 'draft', reviewNote: 'Add a table of contents.' });

    await author.put(`/api/v1/author/products/${id}`).send({ ...book, toc: [{ title: 'Start', page: 1 }] }).expect(200);
    await author.post(`/api/v1/author/products/${id}/submit`).expect(200);
    await admin.post(`/api/v1/admin/products/${id}/publish`).expect(200);
    expect((await author.get(`/api/v1/author/products/${id}`)).body.product).toMatchObject({ status: 'published', reviewNote: null });

    // Taking it out of the store allows edits; it then needs another review.
    await author.post(`/api/v1/author/products/${id}/withdraw`).expect(200);
    await author.put(`/api/v1/author/products/${id}`).send({ ...book, pricePaise: 25_000 }).expect(200);
    expect((await author.get('/api/v1/author/stats')).body.stats.books).toEqual({ total: 1, published: 0, inReview: 0 });
  });

  it('are private to their author', async () => {
    const one = await approvedAuthor();
    const two = await approvedAuthor();
    const created = await one.author.post('/api/v1/author/products').send(book).expect(201);
    expect((await two.author.get(`/api/v1/author/products/${created.body.product.id}`)).status).toBe(404);
    expect((await two.author.get('/api/v1/author/products')).body.items).toEqual([]);
    await one.author.delete(`/api/v1/author/products/${created.body.product.id}`).expect(200);
  });
});

describe('author earnings', () => {
  it('pays the author their share after the affiliate commission, held, then settled by the admin', async () => {
    const { author, admin, profileId } = await approvedAuthor(70);
    const id = await publishedAuthorBook(author, admin);
    const slug = (await Product.findById(id))!.slug;

    // A sale through an affiliate's coupon: 10% off ₹200 = ₹180; 20% commission = ₹36; 70% of ₹144 = ₹100.80.
    const { user: affUser } = await signIn(['customer', 'affiliate']);
    await AffiliateProfile.create({ userId: affUser._id, code: 'RIYA2024', status: 'approved' });
    await admin.post('/api/v1/admin/coupons').send({ code: 'RIYA10', type: 'percent', percentOff: 10, affiliateCode: 'RIYA2024' }).expect(201);
    const first = await agent().post('/api/v1/checkout/orders').send({ productSlug: slug, name: 'Buyer', email: 'b1@example.com', couponCode: 'RIYA10' });
    await pay(first.body.razorpayOrderId);
    // A direct sale: 70% of ₹200 = ₹140.
    const second = await agent().post('/api/v1/checkout/orders').send({ productSlug: slug, name: 'Buyer', email: 'b2@example.com' });
    await pay(second.body.razorpayOrderId);

    const earnings = await AuthorEarning.find().sort({ createdAt: 1 });
    expect(earnings.map((e) => [e.amountPaise, e.lines[0]!.commissionPaise, e.status])).toEqual([
      [10_080, 3_600, 'pending'],
      [14_000, 0, 'pending'],
    ]);
    const stats = (await author.get('/api/v1/author/stats').expect(200)).body.stats;
    expect(stats).toMatchObject({ sales: 2, earnings: { pendingPaise: 24_080, payablePaise: 0, paidPaise: 0 } });

    // Nothing to pay during the hold; afterwards the admin records one payment for both.
    const authorId = profileId;
    expect((await admin.post(`/api/v1/admin/authors/${authorId}/payouts`).send({ reference: 'UTR123456' })).status).toBe(400);
    await AuthorEarning.updateMany({}, { $set: { holdUntil: new Date(Date.now() - 1000) } });
    await author.put('/api/v1/author/me/payout').send({ method: 'upi', upiId: 'asha@okbank' }).expect(200);
    const listed = await admin.get('/api/v1/admin/authors').expect(200);
    expect(listed.body.items[0]).toMatchObject({ payablePaise: 24_080, hasPayoutDetails: true });
    expect((await admin.get(`/api/v1/admin/authors/${authorId}/destination`)).body).toMatchObject({ method: 'upi', upiId: 'asha@okbank' });

    const payout = await admin.post(`/api/v1/admin/authors/${authorId}/payouts`).send({ reference: 'UTR123456' }).expect(201);
    expect(payout.body.payout).toMatchObject({ amountPaise: 24_080, destination: 'UPI asha@okbank' });
    expect((await author.get('/api/v1/author/stats')).body.stats.earnings).toEqual({ pendingPaise: 0, payablePaise: 0, paidPaise: 24_080 });
    const history = await author.get('/api/v1/author/earnings').expect(200);
    expect(history.body.items[0]).toMatchObject({ status: 'paid', books: [{ title: book.title }] });
  });

  it('earns only on the author’s own books in a combo, and follows refunds', async () => {
    const { author, admin } = await approvedAuthor(50);
    const id = await publishedAuthorBook(author, admin, { comboPricePaise: 15_000 });
    const authorSlug = (await Product.findById(id))!.slug;
    await Product.create({ slug: 'house-book', title: 'House Book', description: 'x', status: 'published', publishedAt: new Date(), categories: ['Finance'], pricePaise: 10_000 });

    const combo = await agent().post('/api/v1/checkout/orders').send({ productSlug: 'house-book', addOnSlugs: [authorSlug], name: 'Buyer', email: 'b3@example.com' });
    expect(combo.status).toBe(201);
    await pay(combo.body.razorpayOrderId);
    // 50% of the ₹150 combo price; nothing for the house book.
    const earning = await AuthorEarning.findOne();
    expect(earning).toMatchObject({ amountPaise: 7_500, originalAmountPaise: 7_500 });
    expect(earning!.lines).toHaveLength(1);

    const order = await Order.findOne({ orderNumber: combo.body.orderNumber });
    await admin.post(`/api/v1/admin/orders/${order!._id}/refund`).send({ amountPaise: 12_500, reason: 'Half back' }).expect(200);
    expect((await AuthorEarning.findOne())!.amountPaise).toBe(3_750);
    await admin.post(`/api/v1/admin/orders/${order!._id}/refund`).send({ reason: 'Rest' }).expect(200);
    expect((await AuthorEarning.findOne())!.status).toBe('reversed');
  });

  it('uses the share at order time', async () => {
    const { author, admin, profileId } = await approvedAuthor(70);
    const id = await publishedAuthorBook(author, admin);
    const created = await agent().post('/api/v1/checkout/orders').send({ productSlug: (await Product.findById(id))!.slug, name: 'Buyer', email: 'b4@example.com' });
    await admin.put(`/api/v1/admin/authors/${profileId}/share`).send({ sharePercent: 40 }).expect(200);
    await pay(created.body.razorpayOrderId);
    expect((await AuthorEarning.findOne())!.amountPaise).toBe(14_000);
    expect((await AuthorProfile.findById(profileId))!.sharePercent).toBe(40);
  });
});
