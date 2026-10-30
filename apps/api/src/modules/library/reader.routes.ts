import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { Types } from 'mongoose';
import { HttpError, notFound } from '../../lib/errors';
import { sendObject } from '../../lib/serve';
import { Bookmark } from '../../models/Bookmark';
import { Product, type ProductDoc } from '../../models/Product';
import { ProductAsset } from '../../models/ProductAsset';
import { ReadingProgress } from '../../models/ReadingProgress';
import { findReadableProductBySlug, orderNumberFor, requireReadAccess } from './access';
import { licensedCopyKey } from './copies';

export const readerRouter = Router();

/** The reader sends this header; pasting the book URL into a browser tab does not. */
export const READER_HEADER = 'x-readnshare-reader';

/** Opening a book is cheap after the first time, but scripted bulk fetching is not welcome. */
const bookLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 60,
  skip: () => process.env.DISABLE_RATE_LIMITS === '1',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `reader:${req.auth!.user._id.toString()}`,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests for this book. Please wait a few minutes.' } },
});

async function productById(req: Request): Promise<ProductDoc> {
  const id = String(req.params.productId);
  if (!Types.ObjectId.isValid(id)) throw notFound('eBook not found');
  const product = await Product.findById(id);
  if (!product || !product.pageSetId) throw notFound('eBook not found');
  return product;
}

/** Changes whenever a new PDF goes live, so a copy kept by the browser is never out of date. */
const bookVersion = (product: ProductDoc) => product.pageSetId!.toString().slice(-8);

/** Everything the reader needs to start: page count, size, TOC, progress and bookmarks. */
readerRouter.get('/by-slug/:slug', async (req, res) => {
  const product = await findReadableProductBySlug(String(req.params.slug));
  const userId = req.auth!.user._id;
  await requireReadAccess(userId, product);

  const [progress, bookmarks] = await Promise.all([
    ReadingProgress.findOneAndUpdate(
      { userId, productId: product._id },
      { $set: { lastOpenedAt: new Date(), totalPages: product.pageCount }, $setOnInsert: { page: 1, percent: 0 } },
      { upsert: true, returnDocument: 'after' },
    ),
    Bookmark.find({ userId, productId: product._id }).sort({ page: 1 }),
  ]);

  res.setHeader('Cache-Control', 'private, no-store');
  res.json({
    productId: product._id.toString(),
    slug: product.slug,
    title: product.title,
    author: product.author ?? '',
    pageCount: product.pageCount,
    pageWidth: product.pageWidth ?? 595,
    pageHeight: product.pageHeight ?? 842,
    toc: product.toc.map((t) => ({ title: t.title ?? '', page: t.page ?? 1 })),
    coverUrl: product.coverAssetId ? `/api/v1/reader/${product._id.toString()}/cover?v=${product.coverAssetId.toString()}` : null,
    // Names the file version and the buyer, so the browser can keep the copy (see /book below).
    bookUrl: `/api/v1/reader/${product._id.toString()}/book?v=${bookVersion(product)}&u=${userId.toString()}`,
    readerHeader: READER_HEADER,
    progress: { page: Math.min(progress!.page, product.pageCount) || 1, percent: progress!.percent },
    bookmarks: bookmarks.map((b) => ({ id: b._id.toString(), page: b.page, label: b.label ?? '' })),
  });
});

/**
 * The buyer's personal copy, watermarked with their email and order number. Re-checks the
 * entitlement on every request. Only the in-site reader can open it: it is sent as opaque
 * bytes (no inline PDF viewer, no download prompt) and requires the reader's header.
 *
 * Fetched from the manifest's URL, the copy may stay in that buyer's browser for 30 days, so
 * reopening the book doesn't download it again (the reader still checks access through the
 * manifest first). Only requests with the reader's header can use that kept copy, and CDNs
 * never store it.
 */
readerRouter.get('/:productId/book', bookLimiter, async (req, res) => {
  if (req.get(READER_HEADER) !== '1') {
    throw new HttpError(403, 'READER_ONLY', 'Open this book from your library in the ReadnShare reader.');
  }
  const product = await productById(req);
  const user = req.auth!.user;
  const access = await requireReadAccess(user._id, product);
  const key = await licensedCopyKey(product, user, await orderNumberFor(access.orderId));
  const keep = req.query.v === bookVersion(product) && req.query.u === user._id.toString();
  res.setHeader('Content-Disposition', 'inline');
  res.vary(READER_HEADER);
  await sendObject(res, key, 'application/octet-stream', keep ? 'private, max-age=2592000' : 'private, no-store', 'no-store');
});

readerRouter.get('/:productId/cover', async (req, res) => {
  const product = await productById(req);
  await requireReadAccess(req.auth!.user._id, product);
  const asset = product.coverAssetId ? await ProductAsset.findById(product.coverAssetId) : null;
  if (!asset) throw notFound('No cover');
  await sendObject(res, asset.storageKey, 'image/webp', 'private, max-age=86400');
});
