import { beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { Entitlement } from '../src/models/Entitlement';
import { Product } from '../src/models/Product';
import { processingIdle } from '../src/modules/products/processing';
import { makeImage, makePdf } from './fixtures';
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

describe('reader access', () => {
  it('requires sign-in and an active entitlement for every page', async () => {
    const anon = agent();
    await anon.get('/api/v1/reader/by-slug/reader-book').expect(401);
    await anon.get(`/api/v1/reader/${productId}/pages/1`).expect(401);

    const stranger = await login(`stranger${++n}@example.com`);
    await stranger.get('/api/v1/reader/by-slug/reader-book').expect(403);
    await stranger.get(`/api/v1/reader/${productId}/pages/1`).expect(403);
  });

  it('serves a manifest and watermarked, privately cached pages to owners', async () => {
    const a = await owner('owner@example.com');
    const manifest = await a.get('/api/v1/reader/by-slug/reader-book').expect(200);
    expect(manifest.body).toMatchObject({ pageCount: 4, progress: { page: 1 }, bookmarks: [] });
    expect(JSON.stringify(manifest.body)).not.toMatch(/storageKey|products\/[a-f0-9]{24}\//);

    const page = await a.get(manifest.body.pageUrlTemplate.replace('{page}', '2')).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(page.status).toBe(200);
    expect(page.headers['content-type']).toBe('image/webp');
    expect(page.headers['cache-control']).toContain('private');
    expect((await sharp(page.body as Buffer).metadata()).format).toBe('webp');

    await a.get(`/api/v1/reader/${productId}/pages/5`).expect(404);
    await a.get(`/api/v1/reader/${productId}/pages/0`).expect(404);
  });

  it('keeps archived books readable for owners but blocks refunded ones', async () => {
    const a = await owner();
    await Product.updateOne({ _id: productId }, { $set: { status: 'archived' } });
    await a.get(`/api/v1/reader/${productId}/pages/1`).expect(200);

    await Entitlement.updateMany({}, { $set: { status: 'revoked' } });
    await a.get(`/api/v1/reader/${productId}/pages/1`).expect(403);
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
