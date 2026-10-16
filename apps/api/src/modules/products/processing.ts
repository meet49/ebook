import { Types } from 'mongoose';
import { env } from '../../config/env';
import { pngToWebp } from '../../lib/images';
import { logger } from '../../lib/logger';
import { renderPdfPages } from '../../lib/pdf/run';
import { storage, storageKeys } from '../../lib/storage';
import { Product } from '../../models/Product';
import { ProductAsset } from '../../models/ProductAsset';

/**
 * In-process job queue that turns an uploaded PDF into page images, one product at a time.
 * Suitable for a single API instance; jobs left unfinished by a restart are re-queued at boot.
 * For several instances, move this to a shared queue (see docs/DEPLOYMENT.md).
 */
const queue: string[] = [];
let running: Promise<void> | null = null;

export function enqueueProcessing(productId: string): Promise<void> {
  if (!queue.includes(productId)) queue.push(productId);
  running ??= drain().finally(() => {
    running = null;
  });
  return running;
}

/** Resolves when the queue is empty. Used by tests and graceful shutdown. */
export function processingIdle(): Promise<void> {
  return running ?? Promise.resolve();
}

async function drain(): Promise<void> {
  for (let id = queue.shift(); id; id = queue.shift()) {
    try {
      await processProduct(id);
    } catch (err) {
      logger.error({ err, productId: id }, 'PDF processing failed');
      await Product.updateOne(
        { _id: id },
        { $set: { 'processing.status': 'failed', 'processing.error': friendlyError(err), 'processing.updatedAt': new Date() } },
      );
    }
  }
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/maximum is/.test(msg)) return msg;
  if (/password/i.test(msg)) return 'This PDF is password-protected. Upload an unprotected file.';
  if (/Invalid PDF|corrupt|bad XRef|FormatError/i.test(msg)) return 'This file could not be read as a PDF. It may be damaged.';
  return 'Processing failed. Please try uploading the PDF again.';
}

async function processProduct(productId: string): Promise<void> {
  const product = await Product.findById(productId);
  if (!product?.pdfAssetId) return;
  const source = await ProductAsset.findById(product.pdfAssetId);
  if (!source) throw new Error('Original PDF asset missing');

  const setId = source._id.toString();
  const started = Date.now();
  await Product.updateOne(
    { _id: product._id },
    { $set: { 'processing.status': 'processing', 'processing.error': null, 'processing.done': 0, 'processing.updatedAt': new Date() } },
  );

  // Clear partial output from an interrupted earlier attempt of this same upload.
  await ProductAsset.deleteMany({ sourceAssetId: source._id });
  await storage().deletePrefix(storageKeys.pageSet(productId, setId));

  // A standalone copy whose memory can be handed to the worker; the Buffer is released right after.
  const pdfBytes = new Uint8Array(await storage().getBuffer(source.storageKey));
  const meta = await renderPdfPages(
    pdfBytes,
    env.PAGE_RENDER_WIDTH,
    async ({ page, png, width, height }) => {
      const webp = await pngToWebp(png);
      const key = storageKeys.page(productId, setId, page);
      await storage().put(key, webp, 'image/webp');
      await ProductAsset.create({
        productId: product._id,
        kind: 'page_image',
        storageKey: key,
        mimeType: 'image/webp',
        sizeBytes: webp.length,
        page,
        width,
        height,
        sourceAssetId: source._id,
      });
      await Product.updateOne({ _id: product._id }, { $set: { 'processing.done': page } });
    },
    async ({ numPages }) => {
      await Product.updateOne({ _id: product._id }, { $set: { 'processing.total': numPages } });
    },
  );

  if (meta.numPages < 1) throw new Error('The PDF has no pages');

  // Re-read: the admin may have edited the product while it was processing.
  const fresh = await Product.findById(productId);
  if (!fresh) return;
  if (!fresh.pdfAssetId?.equals(source._id)) {
    // A newer upload superseded this one while it was rendering; discard this output.
    await discardPageSet(productId, source._id);
    return;
  }

  const previousSet = fresh.pageSetId;
  fresh.pageSetId = source._id;
  fresh.pageCount = meta.numPages;
  if (fresh.toc.length === 0 && meta.toc.length > 0) fresh.set('toc', meta.toc);
  const keptPreviews = fresh.previewPages.filter((n) => n <= meta.numPages);
  fresh.previewPages = keptPreviews.length ? keptPreviews : [1, 2, 3].filter((n) => n <= meta.numPages);
  fresh.set('toc', fresh.toc.filter((t) => (t.page ?? 1) <= meta.numPages));
  fresh.set('processing', { status: 'ready', error: null, done: meta.numPages, total: meta.numPages, updatedAt: new Date() });
  await fresh.save();

  if (previousSet && !previousSet.equals(source._id)) await removeOriginalAndPages(productId, previousSet);
  logger.info({ productId, pages: meta.numPages, ms: Date.now() - started }, 'PDF processed');
}

async function discardPageSet(productId: string, setId: Types.ObjectId): Promise<void> {
  await ProductAsset.deleteMany({ sourceAssetId: setId });
  await storage().deletePrefix(storageKeys.pageSet(productId, setId.toString()));
}

/** Removes a superseded original PDF and its rendered pages. */
export async function removeOriginalAndPages(productId: string, originalId: Types.ObjectId): Promise<void> {
  await discardPageSet(productId, originalId);
  const original = await ProductAsset.findOneAndDelete({ _id: originalId, kind: 'original_pdf' });
  if (original) await storage().delete(original.storageKey);
}

/** Re-queues work interrupted by a restart. */
export async function resumePendingProcessing(): Promise<void> {
  const pending = await Product.find({ 'processing.status': { $in: ['queued', 'processing'] } }).select('_id');
  for (const p of pending) void enqueueProcessing(p._id.toString());
  if (pending.length) logger.info({ count: pending.length }, 'Resumed PDF processing');
}
