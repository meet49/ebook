import { beforeEach, describe, expect, it } from 'vitest';
import { Entitlement } from '../src/models/Entitlement';
import { Product } from '../src/models/Product';
import { processingIdle } from '../src/modules/products/processing';
import { binary, makeImage, makePdf, pdfText } from './fixtures';
import { agent, createUser } from './helpers';

const PASSWORD = 'pass-word-1';
let productId: string;
let n = 0;

async function login(email: string, roles: ('customer' | 'admin')[] = ['customer']) {
  await createUser({ email, password: PASSWORD, roles });
  const a = agent();
  await a.post('/api/v1/auth/login').send({ email, password: PASSWORD, portal: roles[0] }).expect(200);
  return a;
}

beforeEach(async () => {
  const admin = await login(`admin${++n}@example.com`, ['admin']);
  const created = await admin.post('/api/v1/admin/products').send({ title: 'Reader Book', description: 'x', pricePaise: 10_000 }).expect(201);
  productId = created.body.product.id;
  await admin.post(`/api/v1/admin/products/${productId}/cover`).attach('file', await makeImage(), 'c.png').expect(200);
  await admin.post(`/api/v1/admin/products/${productId}/pdf`).attach('file', await makePdf(4), 'b.pdf').expect(202);
  await processingIdle();
  await admin.post(`/api/v1/admin/products/${productId}/publish`).expect(200);
});

async function owner(email = `reader${++n}@example.com`) {
  const a = await login(email);
  const user = (await a.get('/api/v1/auth/me')).body.user;
  await Entitlement.create({ userId: user.id, productId });
  return a;
}

const READER = { 'x-readnshare-reader': '1' };
const book = (a: ReturnType<typeof agent>) => a.get(`/api/v1/reader/${productId}/book`).set(READER).buffer(true).parse(binary);

describe('reader access', () => {
  it('requires sign-in and an active entitlement for the book', async () => {
    const anon = agent();
    await anon.get('/api/v1/reader/by-slug/reader-book').expect(401);
    await book(anon).expect(401);

    const stranger = await login(`stranger${++n}@example.com`);
    await stranger.get('/api/v1/reader/by-slug/reader-book').expect(403);
    await book(stranger).expect(403);
  });

  it("delivers the owner's personal, watermarked copy only to the reader", async () => {
    const a = await owner('owner@example.com');
    const manifest = await a.get('/api/v1/reader/by-slug/reader-book').expect(200);
    expect(manifest.body).toMatchObject({ pageCount: 4, progress: { page: 1 }, bookmarks: [], readerHeader: 'x-readnshare-reader' });
    expect(JSON.stringify(manifest.body)).not.toMatch(/storageKey|products\/[a-f0-9]{24}\//);

    // Pasting the URL into a browser (no reader header) does not return the PDF.
    const direct = await a.get(manifest.body.bookUrl);
    expect(direct.status).toBe(403);
    expect(direct.body.error.code).toBe('READER_ONLY');

    const res = await a.get(manifest.body.bookUrl).set(READER).buffer(true).parse(binary).expect(200);
    expect(res.headers['content-type']).toBe('application/octet-stream');
    // The manifest's URL names the file version and the buyer, so the browser may keep the copy
    // (for the reader only); CDNs may not.
    expect(res.headers['cache-control']).toBe('private, max-age=2592000');
    expect(res.headers['vary']).toContain('x-readnshare-reader');
    expect(res.headers['cdn-cache-control']).toBe('no-store');
    expect(res.headers['content-encoding']).toBeUndefined();
    const { pages, text } = await pdfText(res.body as Buffer);
    expect(pages).toBe(4);
    expect(text).toContain('Chapter 2');
    expect(text).toContain('Licensed to owner@example.com');
    expect(text).toContain('Unauthorized copying');

    // The copy is cached: a second open returns identical bytes.
    const again = await book(a).expect(200);
    expect(Buffer.compare(again.body as Buffer, res.body as Buffer)).toBe(0);
    // Any other URL for the book still works, but the browser must not keep that response.
    expect(again.headers['cache-control']).toBe('private, no-store');
  });

  it('gives every buyer their own copy', async () => {
    const first = await owner('first@example.com');
    const second = await owner('second@example.com');
    const t1 = (await pdfText((await book(first).expect(200)).body as Buffer)).text;
    const t2 = (await pdfText((await book(second).expect(200)).body as Buffer)).text;
    expect(t1).toContain('first@example.com');
    expect(t1).not.toContain('second@example.com');
    expect(t2).toContain('second@example.com');

    // Each copy has its own URL, and one buyer can't get their copy kept under another's URL.
    const url1 = (await first.get('/api/v1/reader/by-slug/reader-book')).body.bookUrl as string;
    const url2 = (await second.get('/api/v1/reader/by-slug/reader-book')).body.bookUrl as string;
    expect(url1).not.toBe(url2);
    const crossed = await second.get(url1).set(READER).buffer(true).parse(binary).expect(200);
    expect(crossed.headers['cache-control']).toBe('private, no-store');
    expect((await pdfText(crossed.body as Buffer)).text).toContain('second@example.com');
  });

  it('keeps archived books readable for owners but blocks refunded ones', async () => {
    const a = await owner();
    await Product.updateOne({ _id: productId }, { $set: { status: 'archived' } });
    await book(a).expect(200);

    await Entitlement.updateMany({}, { $set: { status: 'revoked' } });
    await book(a).expect(403);
  });
});

describe('library, progress and bookmarks', () => {
  it('lists owned books with progress and suggests others', async () => {
    const a = await owner();
    let lib = await a.get('/api/v1/me/library').expect(200);
    expect(lib.body.items).toHaveLength(1);
    expect(lib.body.items[0]).toMatchObject({ slug: 'reader-book', readable: true, progress: null });
    expect(lib.body.explore).toHaveLength(0);

    await a.put(`/api/v1/me/progress/${productId}`).send({ page: 3 }).expect(200);
    lib = await a.get('/api/v1/me/library');
    expect(lib.body.items[0].progress).toMatchObject({ page: 3, percent: 75 });
    const manifest = await a.get('/api/v1/reader/by-slug/reader-book');
    expect(manifest.body.progress.page).toBe(3);

    await a.put(`/api/v1/me/progress/${productId}`).send({ page: 9 }).expect(400);
  });

  it('suggests unowned published books', async () => {
    const a = await login(`browser${++n}@example.com`);
    const lib = await a.get('/api/v1/me/library');
    expect(lib.body.items).toHaveLength(0);
    expect(lib.body.explore[0]).toMatchObject({ slug: 'reader-book', effectivePricePaise: 10_000 });
  });

  it('manages bookmarks per user', async () => {
    const a = await owner();
    const created = await a.post('/api/v1/me/bookmarks').send({ productId, page: 2, label: 'Key idea' }).expect(201);
    await a.post('/api/v1/me/bookmarks').send({ productId, page: 2, label: 'Renamed' }).expect(201);
    const list = await a.get('/api/v1/me/bookmarks');
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ page: 2, label: 'Renamed', slug: 'reader-book' });

    const other = await owner();
    await other.delete(`/api/v1/me/bookmarks/${created.body.bookmark.id}`).expect(404);
    await a.delete(`/api/v1/me/bookmarks/${created.body.bookmark.id}`).expect(200);

    const stranger = await login(`nobody${++n}@example.com`);
    await stranger.post('/api/v1/me/bookmarks').send({ productId, page: 1 }).expect(403);
  });
});
