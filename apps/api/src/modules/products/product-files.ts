import { createReadStream } from 'node:fs';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { audit } from '../../lib/audit';
import { HttpError, badRequest, notFound } from '../../lib/errors';
import { processCover } from '../../lib/images';
import { sendObject } from '../../lib/serve';
import { storage, storageKeys } from '../../lib/storage';
import { isPdfFile, removeTemp, sha256File } from '../../middleware/upload';
import type { ProductDoc } from '../../models/Product';
import { ProductAsset } from '../../models/ProductAsset';
import { enqueueProcessing, removeOriginalAndDerived } from './processing';

/** Cover and PDF handling shared by the admin and author book editors. */

export async function saveCover(product: ProductDoc, req: Request): Promise<void> {
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
}

/** Stores an uploaded PDF and queues it for processing. Always removes the temp file. */
export async function savePdf(loadProduct: () => Promise<ProductDoc>, req: Request): Promise<ProductDoc> {
  const tmp = req.file?.path;
  try {
    const product = await loadProduct();
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
    product.set('processing', { status: 'queued', error: null, done: 0, total: 0, attempts: 0, updatedAt: new Date() });
    await product.save();
    if (pending && !(product.pageSetId && pending.equals(product.pageSetId))) {
      await removeOriginalAndDerived(product._id.toString(), pending);
    }

    void enqueueProcessing(product._id.toString());
    await audit({
      action: 'product.pdf_uploaded',
      entityType: 'Product',
      entityId: product._id,
      meta: { sizeBytes: req.file.size, sha256: checksum },
      req,
    });
    return product;
  } finally {
    await removeTemp(tmp);
  }
}

export async function reprocessPdf(product: ProductDoc): Promise<void> {
  if (!product.pdfAssetId) throw badRequest('Upload a PDF first');
  if (product.processing?.status === 'queued' || product.processing?.status === 'processing') {
    throw new HttpError(409, 'BUSY', 'This PDF is already being processed');
  }
  product.set('processing', { status: 'queued', error: null, done: 0, total: 0, attempts: 0, updatedAt: new Date() });
  await product.save();
  void enqueueProcessing(product._id.toString());
}

export async function sendCover(res: Response, product: ProductDoc): Promise<void> {
  const asset = product.coverAssetId ? await ProductAsset.findById(product.coverAssetId) : null;
  if (!asset) throw notFound('No cover uploaded');
  await sendObject(res, asset.storageKey, 'image/webp', 'private, max-age=300');
}

/** The original PDF, for the editor's own preview (never cached). */
export async function sendOriginalPdf(res: Response, product: ProductDoc): Promise<void> {
  const asset = product.pageSetId ? await ProductAsset.findById(product.pageSetId) : null;
  if (!asset) throw notFound('No processed PDF yet');
  await sendObject(res, asset.storageKey, 'application/pdf', 'private, no-store');
}
