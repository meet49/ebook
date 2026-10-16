import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { Types } from 'mongoose';
import { notFound } from '../../lib/errors';
import { sendBuffer, sendObject } from '../../lib/serve';
import { storage } from '../../lib/storage';
import { watermarkPage } from '../../lib/watermark';
import { Bookmark } from '../../models/Bookmark';
import { Product, type ProductDoc } from '../../models/Product';
import { ProductAsset } from '../../models/ProductAsset';
import { ReadingProgress } from '../../models/ReadingProgress';
import { findReadableProductBySlug, orderNumberFor, requireEntitlement } from './access';

export const readerRouter = Router();

/**
 * Per-user page budget. Generous for normal reading and flipping back and forth, but stops
 * scripted bulk downloading of a whole book in one go.
 */
const pageLimiter = rateLimit({
  windowMs: 5 * 60_000,
  limit: 300,
  skip: () => process.env.DISABLE_RATE_LIMITS === '1',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `reader:${req.auth!.user._id.toString()}`,
  message: { error: { code: 'RATE_LIMITED', message: 'You are turning pages very quickly. Please wait a moment.' } },
});

async function productById(req: Request): Promise<ProductDoc> {
  const id = String(req.params.productId);
  if (!Types.ObjectId.isValid(id)) throw notFound('eBook not found');
  const product = await Product.findById(id);
  if (!product || !product.pageSetId) throw notFound('eBook not found');
  return product;
}

/** Everything the reader needs to start: page count, dimensions, TOC, progress and bookmarks. */
readerRouter.get('/by-slug/:slug', async (req, res) => {
  const product = await findReadableProductBySlug(String(req.params.slug));
  const userId = req.auth!.user._id;
  await requireEntitlement(userId, product);

  const [first, progress, bookmarks] = await Promise.all([
    ProductAsset.findOne({ sourceAssetId: product.pageSetId, kind: 'page_image', page: 1 }).select('width height'),
    ReadingProgress.findOneAndUpdate(
      { userId, productId: product._id },
      { $set: { lastOpenedAt: new Date(), totalPages: product.pageCount }, $setOnInsert: { page: 1, percent: 0 } },
      { upsert: true, returnDocument: 'after' },
    ),
    Bookmark.find({ userId, productId: product._id }).sort({ page: 1 }),
  ]);

  const version = product.pageSetId!.toString().slice(-8);
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({
    productId: product._id.toString(),
    slug: product.slug,
    title: product.title,
    author: product.author ?? '',
    pageCount: product.pageCount,
    pageWidth: first?.width ?? 1400,
    pageHeight: first?.height ?? 1980,
    toc: product.toc.map((t) => ({ title: t.title ?? '', page: t.page ?? 1 })),
    coverUrl: product.coverAssetId ? `/api/v1/reader/${product._id.toString()}/cover?v=${product.coverAssetId.toString()}` : null,
    pageUrlTemplate: `/api/v1/reader/${product._id.toString()}/pages/{page}?v=${version}`,
    progress: { page: Math.min(progress!.page, product.pageCount) || 1, percent: progress!.percent },
    bookmarks: bookmarks.map((b) => ({ id: b._id.toString(), page: b.page, label: b.label ?? '' })),
  });
});

/** A single watermarked page. Every request re-checks the entitlement. */
readerRouter.get('/:productId/pages/:page', pageLimiter, async (req, res) => {
  const product = await productById(req);
  const user = req.auth!.user;
  const entitlement = await requireEntitlement(user._id, product);

  const page = Number(req.params.page);
  if (!Number.isInteger(page) || page < 1 || page > product.pageCount) throw notFound('Page not found');
  const asset = await ProductAsset.findOne({ sourceAssetId: product.pageSetId, kind: 'page_image', page });
  if (!asset) throw notFound('Page not found');

  const orderNumber = await orderNumberFor(entitlement.orderId);
  const image = await watermarkPage(await storage().getBuffer(asset.storageKey), {
    footer: `Licensed to ${user.email}${orderNumber ? ` · ${orderNumber}` : ''} · Page ${page}`,
    pattern: user.email,
  });
  // Private: personalised content must never be stored by shared caches.
  await sendBuffer(res, image, 'image/webp', 'private, max-age=600');
});

readerRouter.get('/:productId/cover', async (req, res) => {
  const product = await productById(req);
  await requireEntitlement(req.auth!.user._id, product);
  const asset = product.coverAssetId ? await ProductAsset.findById(product.coverAssetId) : null;
  if (!asset) throw notFound('No cover');
  await sendObject(res, asset.storageKey, 'image/webp', 'private, max-age=86400');
});
