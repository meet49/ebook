import { createReadStream } from 'node:fs';
import { Router, type Request } from 'express';
import { Types } from 'mongoose';
import { adminProductQuerySchema, productInputSchema, type ProductInputParsed } from '@ebook/shared';
import { audit } from '../../lib/audit';
import { HttpError, badRequest, notFound } from '../../lib/errors';
import { processCover } from '../../lib/images';
import { sendObject } from '../../lib/serve';
import { storage, storageKeys } from '../../lib/storage';
import { imageUpload, isPdfFile, pdfUpload, removeTemp, sha256File } from '../../middleware/upload';
import { parse } from '../../middleware/validate';
import { Product, type ProductDoc } from '../../models/Product';
import { ProductAsset } from '../../models/ProductAsset';
import { enqueueProcessing, removeOriginalAndPages } from './processing';
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
function assertPagesExist(input: ProductInputParsed, pageCount: number): void {
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
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { slug: rx }, { author: rx }];
  }
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    Product.countDocuments(filter),
  ]);
  res.json({ items: await Promise.all(items.map(toAdmin)), page, pageSize, total });
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
  publish: { from: ['draft', 'unpublished'], to: 'published' },
  unpublish: { from: ['published'], to: 'unpublished' },
  archive: { from: ['draft', 'published', 'unpublished'], to: 'archived' },
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
    }
    product.status = rule.to;
    await product.save();
    await audit({ action: `product.${action}`, entityType: 'Product', entityId: product._id, req });
    res.json({ product: await toAdmin(product) });
  });
}

adminProductsRouter.post('/:id/cover', imageUpload, async (req, res) => {
  const product = await loadProduct(req);
  if (!req.file) throw badRequest('Choose an image to upload');

  const cover = await processCover(req.file.buffer);
  const assetId = new Types.ObjectId();
  const key = storageKeys.cover(product._id.toString(), assetId.toString());
  await storage().put(key, cover.data, 'image/webp');
  await ProductAsset.create({
    _id: assetId,
    productId: product._id,
    kind: 'cover',
    storageKey: key,
    mimeType: 'image/webp',
    sizeBytes: cover.data.length,
    width: cover.width,
    height: cover.height,
    originalFilename: req.file.originalname.slice(0, 200),
    uploadedBy: req.auth!.user._id,
  });

  const previous = product.coverAssetId;
  product.coverAssetId = assetId;
  await product.save();
  if (previous) {
    const old = await ProductAsset.findByIdAndDelete(previous);
    if (old) await storage().delete(old.storageKey);
  }
  await audit({ action: 'product.cover_uploaded', entityType: 'Product', entityId: product._id, req });
  res.json({ product: await toAdmin(product) });
});

adminProductsRouter.post('/:id/pdf', pdfUpload, async (req, res) => {
  const tmp = req.file?.path;
  try {
    const product = await loadProduct(req);
    if (!req.file || !tmp) throw badRequest('Choose a PDF to upload');
    if (!(await isPdfFile(tmp))) throw badRequest('This file is not a PDF');

    const assetId = new Types.ObjectId();
    const key = storageKeys.original(product._id.toString(), assetId.toString());
    const checksum = await sha256File(tmp);
    await storage().put(key, createReadStream(tmp), 'application/pdf');
    await ProductAsset.create({
      _id: assetId,
      productId: product._id,
      kind: 'original_pdf',
      storageKey: key,
      mimeType: 'application/pdf',
      sizeBytes: req.file.size,
      checksumSha256: checksum,
      originalFilename: req.file.originalname.slice(0, 200),
      uploadedBy: req.auth!.user._id,
    });

    // An earlier upload that never went live (still processing or failed) is superseded now.
    const pending = product.pdfAssetId;
    product.pdfAssetId = assetId;
    product.set('processing', { status: 'queued', error: null, done: 0, total: 0, updatedAt: new Date() });
    await product.save();
    if (pending && !(product.pageSetId && pending.equals(product.pageSetId))) {
      await removeOriginalAndPages(product._id.toString(), pending);
    }

    void enqueueProcessing(product._id.toString());
    await audit({
      action: 'product.pdf_uploaded',
      entityType: 'Product',
      entityId: product._id,
      meta: { sizeBytes: req.file.size, sha256: checksum },
      req,
    });
    res.status(202).json({ product: await toAdmin(product) });
  } finally {
    await removeTemp(tmp);
  }
});

adminProductsRouter.post('/:id/reprocess', async (req, res) => {
  const product = await loadProduct(req);
  if (!product.pdfAssetId) throw badRequest('Upload a PDF first');
  if (product.processing?.status === 'queued' || product.processing?.status === 'processing') {
    throw new HttpError(409, 'BUSY', 'This PDF is already being processed');
  }
  product.set('processing', { status: 'queued', error: null, done: 0, total: 0, updatedAt: new Date() });
  await product.save();
  void enqueueProcessing(product._id.toString());
  res.status(202).json({ product: await toAdmin(product) });
});

adminProductsRouter.get('/:id/cover', async (req, res) => {
  const product = await loadProduct(req);
  const asset = product.coverAssetId ? await ProductAsset.findById(product.coverAssetId) : null;
  if (!asset) throw notFound('No cover uploaded');
  await sendObject(res, asset.storageKey, 'image/webp', 'private, max-age=300');
});

/** Admin preview of any rendered page (not watermarked, never cached publicly). */
adminProductsRouter.get('/:id/pages/:page', async (req, res) => {
  const product = await loadProduct(req);
  const page = Number(req.params.page);
  if (!Number.isInteger(page) || page < 1 || !product.pageSetId) throw notFound('Page not found');
  const asset = await ProductAsset.findOne({ sourceAssetId: product.pageSetId, kind: 'page_image', page });
  if (!asset) throw notFound('Page not found');
  await sendObject(res, asset.storageKey, 'image/webp', 'private, no-store');
});
