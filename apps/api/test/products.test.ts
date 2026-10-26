import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { AdminProduct } from '@ebook/shared';
import { ProductAsset } from '../src/models/ProductAsset';
import { processingIdle } from '../src/modules/products/processing';
import { binary, makeImage, makePdf, pdfText } from './fixtures';
import { agent, app, createUser } from './helpers';

const PASSWORD = 'admin-pass-1';
let admin: ReturnType<typeof agent>;
let coverPng: Buffer;

beforeAll(async () => {
  coverPng = await makeImage();
});

const draft = (over: Record<string, unknown> = {}) => ({
  title: 'Deep Focus',
  author: 'A. Writer',
  description: 'Learn to focus.',
  pricePaise: 49_900,
  categories: ['Productivity'],
  ...over,
});

let adminCount = 0;

beforeEach(async () => {
  // A fresh admin per test keeps the real per-email login rate limit out of the way.
  const email = `admin${++adminCount}@example.com`;
  await createUser({ email, password: PASSWORD, roles: ['admin'] });
  admin = agent();
  await admin.post('/api/v1/auth/login').send({ email, password: PASSWORD, portal: 'admin' }).expect(200);
});

async function createProduct(over: Record<string, unknown> = {}): Promise<AdminProduct> {
  const res = await admin.post('/api/v1/admin/products').send(draft(over)).expect(201);
  return res.body.product;
}

async function uploadPdf(id: string, pages: number) {
  const res = await admin.post(`/api/v1/admin/products/${id}/pdf`).attach('file', await makePdf(pages), 'book.pdf');
  await processingIdle();
  return res;
}

function uploadCover(id: string) {
  return admin.post(`/api/v1/admin/products/${id}/cover`).attach('file', coverPng, 'cover.png');
}

/** A published, fully processed product. */
async function publishedProduct(over: Record<string, unknown> = {}, pages = 3): Promise<AdminProduct> {
  const p = await createProduct(over);
  await uploadCover(p.id).expect(200);
  await uploadPdf(p.id, pages);
  const res = await admin.post(`/api/v1/admin/products/${p.id}/publish`).expect(200);
  return res.body.product;
}

describe('admin product management', () => {
  it('is admin-only', async () => {
    await request(app).get('/api/v1/admin/products').expect(401);
    await createUser({ email: 'c@example.com', password: PASSWORD });
    const customer = agent();
    await customer.post('/api/v1/auth/login').send({ email: 'c@example.com', password: PASSWORD });
    await customer.get('/api/v1/admin/products').expect(403);
    await customer.post('/api/v1/admin/products').send(draft()).expect(403);
  });

  it('creates drafts with unique generated slugs', async () => {
    const a = await createProduct();
    const b = await createProduct();
    expect(a).toMatchObject({ slug: 'deep-focus', status: 'draft', effectivePricePaise: 49_900 });
    expect(b.slug).toBe('deep-focus-2');
    const dup = await admin.post('/api/v1/admin/products').send(draft({ slug: 'deep-focus' }));
    expect(dup.status).toBe(409);
  });

  it('validates pricing on the server', async () => {
    const res = await admin.post('/api/v1/admin/products').send(draft({ salePricePaise: 60_000 }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.salePricePaise).toBeDefined();
    await admin.post('/api/v1/admin/products').send(draft({ pricePaise: 10.5 })).expect(400);
  });

  it('refuses to publish until cover, PDF and description exist', async () => {
    const p = await createProduct({ description: '' });
    const res = await admin.post(`/api/v1/admin/products/${p.id}/publish`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_READY');
    expect(res.body.error.details.publish).toHaveLength(3);
  });

  it('accepts only real images as covers', async () => {
    const p = await createProduct();
    const bad = await admin.post(`/api/v1/admin/products/${p.id}/cover`).attach('file', Buffer.from('not an image'), 'x.png');
    expect(bad.status).toBe(400);
    const small = await admin.post(`/api/v1/admin/products/${p.id}/cover`).attach('file', await makeImage(100, 100), 'x.png');
    expect(small.status).toBe(400);

    const ok = await uploadCover(p.id).expect(200);
    expect(ok.body.product.coverUrl).toMatch(/^\/api\/v1\/admin\/products\/.+\/cover\?v=/);
    const img = await admin.get(ok.body.product.coverUrl).expect(200);
    expect(img.headers['content-type']).toBe('image/webp');

    await uploadCover(p.id).expect(200);
    expect(await ProductAsset.countDocuments({ kind: 'cover' })).toBe(1);
  });

  it('rejects files that are not PDFs regardless of name', async () => {
    const p = await createProduct();
    const res = await admin.post(`/api/v1/admin/products/${p.id}/pdf`).attach('file', await makeImage(), 'book.pdf');
    expect(res.status).toBe(400);
    expect(await ProductAsset.countDocuments({ kind: 'original_pdf' })).toBe(0);
  });

  it('analyses an uploaded PDF without rendering page images', async () => {
    const p = await createProduct();
    const res = await uploadPdf(p.id, 3);
    expect(res.status).toBe(202);
    expect(res.body.product.processing.status).toBe('queued');

    const after = (await admin.get(`/api/v1/admin/products/${p.id}`)).body.product as AdminProduct;
    expect(after.processing).toMatchObject({ status: 'ready', done: 3, total: 3 });
    expect(after.pageCount).toBe(3);
    expect(after.previewPages).toEqual([1, 2, 3]);
    expect(after.pdf).toMatchObject({ filename: 'book.pdf' });
    expect(await ProductAsset.countDocuments({ kind: 'page_image' })).toBe(0);

    const pdf = await admin.get(`/api/v1/admin/products/${p.id}/pdf`).buffer(true).parse(binary).expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['cache-control']).toContain('no-store');
    expect((await pdfText(pdf.body as Buffer)).pages).toBe(3);
  });

  it('swaps in a re-uploaded PDF and removes the old one', async () => {
    const p = await createProduct();
    await uploadPdf(p.id, 3);
    await uploadPdf(p.id, 2);
    const after = (await admin.get(`/api/v1/admin/products/${p.id}`)).body.product as AdminProduct;
    expect(after.pageCount).toBe(2);
    expect(after.previewPages).toEqual([1, 2]);
    expect(await ProductAsset.countDocuments({ kind: 'original_pdf' })).toBe(1);
  });

  it('marks unreadable PDFs as failed with a helpful message', async () => {
    const p = await createProduct();
    await admin
      .post(`/api/v1/admin/products/${p.id}/pdf`)
      .attach('file', Buffer.from('%PDF-1.7\nthis is not really a pdf'), 'broken.pdf')
      .expect(202);
    await processingIdle();
    const after = (await admin.get(`/api/v1/admin/products/${p.id}`)).body.product as AdminProduct;
    expect(after.processing.status).toBe('failed');
    expect(after.processing.error).toBeTruthy();
    expect(after.publishBlockers.join(' ')).toMatch(/failed/);
  });

  it('rejects preview pages beyond the page count', async () => {
    const p = await createProduct();
    await uploadPdf(p.id, 2);
    const res = await admin.put(`/api/v1/admin/products/${p.id}`).send(draft({ slug: p.slug, previewPages: [1, 5] }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.previewPages).toBeDefined();
  });

  it('enforces status transitions', async () => {
    const p = await publishedProduct();
    expect(p.status).toBe('published');
    expect(p.publishedAt).toBeTruthy();
    await admin.post(`/api/v1/admin/products/${p.id}/publish`).expect(409);
    await admin.post(`/api/v1/admin/products/${p.id}/unpublish`).expect(200);
    await admin.post(`/api/v1/admin/products/${p.id}/archive`).expect(200);
    await admin.post(`/api/v1/admin/products/${p.id}/unpublish`).expect(409);
    const restored = await admin.post(`/api/v1/admin/products/${p.id}/restore`).expect(200);
    expect(restored.body.product.status).toBe('draft');
  });
});

describe('public catalog', () => {
  it('lists only published products', async () => {
    const live = await publishedProduct();
    await createProduct({ title: 'Secret Draft' });
    const res = await request(app).get('/api/v1/products').expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({ slug: live.slug, coverUrl: expect.stringMatching(/^\/api\/v1\/products\//) });

    await request(app).get('/api/v1/products/secret-draft').expect(404);
    await admin.post(`/api/v1/admin/products/${live.id}/unpublish`).expect(200);
    await request(app).get(`/api/v1/products/${live.slug}`).expect(404);
    await request(app).get(`/api/v1/products/${live.slug}/cover`).expect(404);
  });

  it('never leaks storage keys or commission settings', async () => {
    const live = await publishedProduct();
    const list = await request(app).get('/api/v1/products');
    const detail = await request(app).get(`/api/v1/products/${live.slug}`);
    for (const body of [JSON.stringify(list.body), JSON.stringify(detail.body)]) {
      expect(body).not.toMatch(/storageKey|original|affiliate|\.pdf/);
    }
    expect(detail.body.product).toMatchObject({ description: 'Learn to focus.' });
  });

  it('searches, filters by category and sorts by price', async () => {
    await publishedProduct({ title: 'Cheap Habits', pricePaise: 19_900, categories: ['Habits'] }, 1);
    await publishedProduct({ title: 'Pricey Focus', pricePaise: 99_900, salePricePaise: 29_900, categories: ['Focus'] }, 1);
    await publishedProduct({ title: 'Mid Focus', pricePaise: 49_900, categories: ['Focus'] }, 1);

    const focus = await request(app).get('/api/v1/products?category=Focus&sort=price_asc');
    expect(focus.body.items.map((p: { title: string }) => p.title)).toEqual(['Pricey Focus', 'Mid Focus']);
    expect(focus.body.items[0]).toMatchObject({ effectivePricePaise: 29_900, discountPercent: 70 });

    const search = await request(app).get('/api/v1/products?q=habit');
    expect(search.body.total).toBe(1);

    const cats = await request(app).get('/api/v1/products/categories');
    expect(cats.body.categories).toEqual(['Focus', 'Habits']);

    await request(app).get('/api/v1/products?sort=bogus').expect(400);
  });

  it('never exposes preview pages of a book publicly', async () => {
    const live = await publishedProduct({}, 3);
    const detail = await request(app).get(`/api/v1/products/${live.slug}`).expect(200);
    expect(detail.body.product).not.toHaveProperty('sample');
    await request(app).get(`/api/v1/products/${live.slug}/sample`).expect(404);
  });
});
