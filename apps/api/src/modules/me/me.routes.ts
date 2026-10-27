import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { badRequest, notFound } from '../../lib/errors';
import { parse } from '../../middleware/validate';
import { Bookmark } from '../../models/Bookmark';
import { Entitlement } from '../../models/Entitlement';
import { Order } from '../../models/Order';
import { Product } from '../../models/Product';
import { ReadingProgress } from '../../models/ReadingProgress';
import { toCustomerOrder } from '../checkout/orders.dto';
import { offersForUser } from '../checkout/pricing';
import { ACCESS_FIELDS, requireReadAccess } from '../library/access';
import { MEMBER_BOOKS, membershipFor } from '../membership/membership.routes';
import { toSummary } from '../products/products.service';

export const meRouter = Router();

/** Same-category books at their combo price for 24 hours after a purchase. */
meRouter.get('/offers', async (req, res) => {
  const offers = await offersForUser(req.auth!.user._id);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ offers: { expiresAt: offers.expiresAt?.toISOString() ?? null, items: offers.products.map(toSummary) } });
});

meRouter.get('/orders', async (req, res) => {
  const orders = await Order.find({ userId: req.auth!.user._id, status: { $ne: 'created' } }).sort({ createdAt: -1 }).limit(200);
  res.json({ items: orders.map(toCustomerOrder) });
});

/** Owned books with reading progress, most recently opened first, and the books a membership opens. */
meRouter.get('/library', async (req, res) => {
  const userId = req.auth!.user._id;
  const [entitlements, membership] = await Promise.all([Entitlement.find({ userId, status: 'active' }).sort({ grantedAt: -1 }), membershipFor(userId)]);
  const productIds = entitlements.map((e) => e.productId);
  const memberBooks = membership ? await Product.find({ ...MEMBER_BOOKS, _id: { $nin: productIds }, pageSetId: { $ne: null } }).sort({ featured: -1, publishedAt: -1 }) : [];
  const [products, progress] = await Promise.all([
    Product.find({ _id: { $in: productIds } }),
    ReadingProgress.find({ userId, productId: { $in: [...productIds, ...memberBooks.map((p) => p._id)] } }),
  ]);
  const progressBy = new Map(progress.map((p) => [p.productId.toString(), p]));
  const productBy = new Map(products.map((p) => [p._id.toString(), p]));

  const items = entitlements.flatMap((e) => {
    const p = productBy.get(e.productId.toString());
    if (!p) return [];
    const pr = progressBy.get(p._id.toString());
    return [
      {
        productId: p._id.toString(),
        slug: p.slug,
        title: p.title,
        author: p.author ?? '',
        coverUrl: p.coverAssetId ? `/api/v1/reader/${p._id.toString()}/cover?v=${p.coverAssetId.toString()}` : null,
        pageCount: p.pageCount,
        readable: Boolean(p.pageSetId),
        purchasedAt: e.grantedAt.toISOString(),
        progress: pr ? { page: pr.page, percent: pr.percent, lastOpenedAt: pr.lastOpenedAt.toISOString() } : null,
      },
    ];
  });
  items.sort((a, b) => (b.progress?.lastOpenedAt ?? b.purchasedAt).localeCompare(a.progress?.lastOpenedAt ?? a.purchasedAt));

  // Books the membership opens, ones being read first.
  const membershipItems = memberBooks
    .map((p) => {
      const pr = progressBy.get(p._id.toString());
      return {
        productId: p._id.toString(),
        slug: p.slug,
        title: p.title,
        author: p.author ?? '',
        coverUrl: p.coverAssetId ? `/api/v1/reader/${p._id.toString()}/cover?v=${p.coverAssetId.toString()}` : null,
        pageCount: p.pageCount,
        readable: true,
        purchasedAt: null,
        progress: pr ? { page: pr.page, percent: pr.percent, lastOpenedAt: pr.lastOpenedAt.toISOString() } : null,
      };
    })
    .sort((a, b) => (b.progress?.lastOpenedAt ?? '').localeCompare(a.progress?.lastOpenedAt ?? ''));

  // Other published books, so the library doubles as a place to discover more.
  const explore = await Product.find({ status: 'published', kind: { $ne: 'membership' }, _id: { $nin: [...productIds, ...memberBooks.map((p) => p._id)] } })
    .sort({ featured: -1, publishedAt: -1 })
    .limit(8);
  // Whether a plan is on sale, so the library can suggest one.
  const membershipAvailable = !membership && (await Product.exists({ kind: 'membership', status: 'published' })) !== null;
  res.json({ items, membership, membershipItems, membershipAvailable, explore: explore.map(toSummary) });
});

const progressBody = z.object({ page: z.number().int().min(1) });

meRouter.put('/progress/:productId', async (req, res) => {
  const { page } = parse(progressBody, req.body);
  const id = String(req.params.productId);
  if (!Types.ObjectId.isValid(id)) throw notFound('eBook not found');
  const product = await Product.findById(id).select(`pageCount ${ACCESS_FIELDS}`);
  if (!product) throw notFound('eBook not found');
  await requireReadAccess(req.auth!.user._id, product);
  if (page > product.pageCount) throw badRequest('Page out of range');

  const percent = product.pageCount ? Math.round((page / product.pageCount) * 100) : 0;
  await ReadingProgress.updateOne(
    { userId: req.auth!.user._id, productId: product._id },
    { $set: { page, percent, totalPages: product.pageCount, lastOpenedAt: new Date() } },
    { upsert: true },
  );
  res.json({ page, percent });
});

meRouter.get('/bookmarks', async (req, res) => {
  const userId = req.auth!.user._id;
  const bookmarks = await Bookmark.find({ userId }).sort({ updatedAt: -1 }).limit(500);
  const products = await Product.find({ _id: { $in: [...new Set(bookmarks.map((b) => b.productId.toString()))] } }).select('title slug');
  const byId = new Map(products.map((p) => [p._id.toString(), p]));
  res.json({
    items: bookmarks.flatMap((b) => {
      const p = byId.get(b.productId.toString());
      return p
        ? [{ id: b._id.toString(), productId: p._id.toString(), slug: p.slug, title: p.title, page: b.page, label: b.label ?? '', createdAt: b.createdAt.toISOString() }]
        : [];
    }),
  });
});

const bookmarkBody = z.object({
  productId: z.string().refine((v) => Types.ObjectId.isValid(v), 'Invalid eBook'),
  page: z.number().int().min(1),
  label: z.string().trim().max(120).default(''),
});

meRouter.post('/bookmarks', async (req, res) => {
  const { productId, page, label } = parse(bookmarkBody, req.body);
  const product = await Product.findById(productId).select(`pageCount ${ACCESS_FIELDS}`);
  if (!product) throw notFound('eBook not found');
  await requireReadAccess(req.auth!.user._id, product);
  if (page > product.pageCount) throw badRequest('Page out of range');

  const bookmark = await Bookmark.findOneAndUpdate(
    { userId: req.auth!.user._id, productId: product._id, page },
    { $set: { label } },
    { upsert: true, returnDocument: 'after' },
  );
  res.status(201).json({ bookmark: { id: bookmark!._id.toString(), page, label } });
});

meRouter.delete('/bookmarks/:id', async (req, res) => {
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) throw notFound('Bookmark not found');
  const result = await Bookmark.deleteOne({ _id: id, userId: req.auth!.user._id });
  if (!result.deletedCount) throw notFound('Bookmark not found');
  res.json({ ok: true });
});
