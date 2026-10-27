import { Router, type Request } from 'express';
import { Types } from 'mongoose';
import { adminProductQuerySchema, authorReviewNoteSchema, productInputSchema, type ProductInputParsed } from '@ebook/shared';
import { audit } from '../../lib/audit';
import { HttpError, badRequest, notFound } from '../../lib/errors';
import { storage } from '../../lib/storage';
import { imageUpload, pdfUpload } from '../../middleware/upload';
import { parse } from '../../middleware/validate';
import { Product, type ProductDoc } from '../../models/Product';
import { AffiliateProduct } from '../../models/AffiliateProduct';
import { Commission } from '../../models/Commission';
import { Entitlement } from '../../models/Entitlement';
import { Order } from '../../models/Order';
import { ProductAsset } from '../../models/ProductAsset';
import { removeOriginalAndDerived } from './processing';
import { reprocessPdf, saveCover, savePdf, sendCover, sendOriginalPdf } from './product-files';
import { applyInput, publishBlockers, resolveSlug, toAdmin } from './products.service';

export const adminProductsRouter = Router();

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function loadProduct(req: Request): Promise<ProductDoc> {
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) throw notFound('eBook not found');
  const product = await Product.findById(id);
  if (!product) throw notFound('eBook not found');
  return product;
}

/** Preview and TOC pages must exist once the page count is known. */
export function assertPagesExist(input: ProductInputParsed, pageCount: number): void {
  if (pageCount < 1) return;
  const badPreview = input.previewPages.find((n) => n > pageCount);
  if (badPreview) {
    throw badRequest(`This eBook has ${pageCount} pages`, { previewPages: [`Page ${badPreview} does not exist`] });
  }
  const badToc = input.toc.find((t) => t.page > pageCount);
  if (badToc) throw badRequest(`This eBook has ${pageCount} pages`, { toc: [`"${badToc.title}" points to page ${badToc.page}`] });
}

adminProductsRouter.get('/', async (req, res) => {
  const { q, status, page, pageSize } = parse(adminProductQuerySchema, req.query);
  const filter: Record<string, unknown> = { kind: { $ne: 'membership' } };
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { slug: rx }, { author: rx }];
  }
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    Product.countDocuments(filter),
  ]);
  res.json({ items: await Promise.all(items.map((p) => toAdmin(p))), page, pageSize, total });
});

adminProductsRouter.post('/', async (req, res) => {
  const input = parse(productInputSchema, req.body);
  const product = new Product({ status: 'draft' });
  applyInput(product, input);
  product.slug = await resolveSlug(input.title, input.slug);
  await product.save();
  await audit({ action: 'product.created', entityType: 'Product', entityId: product._id, meta: { slug: product.slug }, req });
  res.status(201).json({ product: await toAdmin(product) });
});

adminProductsRouter.get('/:id', async (req, res) => {
  res.json({ product: await toAdmin(await loadProduct(req)) });
});

adminProductsRouter.put('/:id', async (req, res) => {
  const product = await loadProduct(req);
  const input = parse(productInputSchema, req.body);
  assertPagesExist(input, product.pageCount);
  const previousSlug = product.slug;
  applyInput(product, input);
  product.slug = await resolveSlug(input.title, input.slug ?? product.slug, product._id);
  await product.save();
  await audit({
    action: 'product.updated',
    entityType: 'Product',
    entityId: product._id,
    meta: previousSlug !== product.slug ? { slugChanged: { from: previousSlug, to: product.slug } } : undefined,
    req,
  });
  res.json({ product: await toAdmin(product) });
});

const TRANSITIONS = {
  // Publishing a book in review approves the author's submission.
  publish: { from: ['draft', 'in_review', 'unpublished'], to: 'published' },
  unpublish: { from: ['published'], to: 'unpublished' },
  archive: { from: ['draft', 'in_review', 'published', 'unpublished'], to: 'archived' },
  restore: { from: ['archived'], to: 'draft' },
} as const;

for (const [action, rule] of Object.entries(TRANSITIONS)) {
  adminProductsRouter.post(`/:id/${action}`, async (req, res) => {
    const product = await loadProduct(req);
    if (!(rule.from as readonly string[]).includes(product.status)) {
      throw new HttpError(409, 'INVALID_STATUS', `A ${product.status} eBook cannot be ${action === 'restore' ? 'restored' : `${action}ed`}`);
    }
    if (rule.to === 'published') {
      const blockers = publishBlockers(product);
      if (blockers.length) throw new HttpError(409, 'NOT_READY', 'This eBook is not ready to publish', { publish: blockers });
      product.publishedAt ??= new Date();
      product.set('review.note', null);
    }
    product.status = rule.to;
    await product.save();
    await audit({ action: `product.${action}`, entityType: 'Product', entityId: product._id, req });
    res.json({ product: await toAdmin(product) });
  });
}

/** Sends an author's book back to them with a note on what to change. */
adminProductsRouter.post('/:id/request-changes', async (req, res) => {
  const product = await loadProduct(req);
  const { note } = parse(authorReviewNoteSchema, req.body);
  if (product.status !== 'in_review') throw new HttpError(409, 'INVALID_STATUS', 'Only an eBook in review can be sent back to its author');
  product.status = 'draft';
  product.set('review', { submittedAt: product.review?.submittedAt ?? null, note });
  await product.save();
  await audit({ action: 'product.changes_requested', entityType: 'Product', entityId: product._id, meta: { note }, req });
  res.json({ product: await toAdmin(product) });
});

/**
 * Permanently deletes a book and its files. Only books nobody has paid for can be deleted:
 * buyers keep reading what they bought, and order history must stay intact, so a sold book
 * is archived instead.
 */
adminProductsRouter.delete('/:id', async (req, res) => {
  const product = await loadProduct(req);
  await deleteUnsoldProduct(product);
  await audit({ action: 'product.deleted', entityType: 'Product', entityId: product._id, meta: { title: product.title, slug: product.slug }, req });
  res.json({ ok: true });
});

export async function deleteUnsoldProduct(product: ProductDoc): Promise<void> {
  const ref = { $or: [{ productId: product._id }, { 'items.productId': product._id }] };
  const [sold, owned, earned] = await Promise.all([
    Order.exists({ ...ref, status: { $in: ['paid', 'partially_refunded', 'refunded'] } }),
    Entitlement.exists({ productId: product._id }),
    Commission.exists({ productId: product._id }),
  ]);
  if (sold || owned || earned) {
    throw new HttpError(409, 'HAS_SALES', 'This eBook has been bought, so it cannot be deleted. Archive it instead — buyers keep access.');
  }
  if (product.processing?.status === 'queued' || product.processing?.status === 'processing') {
    throw new HttpError(409, 'PROCESSING', 'The PDF is still being processed. Try again in a moment.');
  }

  if (product.pdfAssetId) await removeOriginalAndDerived(product._id.toString(), product.pdfAssetId);
  const assets = await ProductAsset.find({ productId: product._id });
  await Promise.all(assets.map((a) => storage().delete(a.storageKey)));
  await ProductAsset.deleteMany({ productId: product._id });
  await AffiliateProduct.deleteMany({ productId: product._id });
  await Product.deleteOne({ _id: product._id });
}

adminProductsRouter.post('/:id/cover', imageUpload, async (req, res) => {
  const product = await loadProduct(req);
  await saveCover(product, req);
  res.json({ product: await toAdmin(product) });
});

adminProductsRouter.post('/:id/pdf', pdfUpload, async (req, res) => {
  const product = await savePdf(() => loadProduct(req), req);
  res.status(202).json({ product: await toAdmin(product) });
});

adminProductsRouter.post('/:id/reprocess', async (req, res) => {
  const product = await loadProduct(req);
  await reprocessPdf(product);
  res.status(202).json({ product: await toAdmin(product) });
});

adminProductsRouter.get('/:id/cover', async (req, res) => {
  await sendCover(res, await loadProduct(req));
});

/** The original PDF, for the admin's own preview (never cached). */
adminProductsRouter.get('/:id/pdf', async (req, res) => {
  await sendOriginalPdf(res, await loadProduct(req));
});
