import type { Types } from 'mongoose';
import { analyzePdf } from '../../lib/pdf/analyze';
import { logger } from '../../lib/logger';
import { storage, storageKeys } from '../../lib/storage';
import { Product } from '../../models/Product';
import { ProductAsset } from '../../models/ProductAsset';

/**
 * In-process queue that prepares an uploaded PDF: reads its page count, page size and
 * bookmarks. Nothing is rendered — buyers get a personally watermarked copy of the PDF
 * itself — so this is quick and light even on a small server.
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

export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/maximum is/.test(msg)) return msg;
  if (/password/i.test(msg)) return 'This PDF is password-protected. Upload an unprotected file.';
  if (/out of memory|SIGKILL|stopped unexpectedly/i.test(msg)) {
    return 'The server ran out of memory while preparing this PDF. Try a compressed PDF, or upgrade the server plan.';
  }
  if (/Invalid PDF|corrupt|bad XRef|FormatError|No PDF header|Failed to parse/i.test(msg)) {
    return 'This file could not be read as a PDF. It may be damaged.';
  }
  return 'Processing failed. Please try uploading the PDF again.';
}

async function processProduct(productId: string): Promise<void> {
  const product = await Product.findById(productId);
  if (!product?.pdfAssetId) return;
  const source = await ProductAsset.findById(product.pdfAssetId);
  if (!source) throw new Error('Original PDF asset missing');

  const started = Date.now();
  await Product.updateOne(
    { _id: product._id },
    {
      $set: { 'processing.status': 'processing', 'processing.error': null, 'processing.done': 0, 'processing.updatedAt': new Date() },
      $inc: { 'processing.attempts': 1 },
    },
  );

  const info = await analyzePdf(new Uint8Array(await storage().getBuffer(source.storageKey)));

  // Re-read: the admin may have edited the product (or uploaded another PDF) meanwhile.
  const fresh = await Product.findById(productId);
  if (!fresh || !fresh.pdfAssetId?.equals(source._id)) return;

  const previous = fresh.pageSetId;
  fresh.pageSetId = source._id;
  fresh.pageCount = info.numPages;
  fresh.pageWidth = info.pageWidth;
  fresh.pageHeight = info.pageHeight;
  if (fresh.toc.length === 0 && info.toc.length > 0) fresh.set('toc', info.toc);
  const keptPreviews = fresh.previewPages.filter((n) => n <= info.numPages);
  fresh.previewPages = keptPreviews.length ? keptPreviews : [1, 2, 3].filter((n) => n <= info.numPages);
  fresh.set('toc', fresh.toc.filter((t) => (t.page ?? 1) <= info.numPages));
  fresh.set('processing', { status: 'ready', error: null, done: info.numPages, total: info.numPages, attempts: 0, updatedAt: new Date() });
  await fresh.save();

  if (previous && !previous.equals(source._id)) await removeOriginalAndDerived(productId, previous);
  logger.info({ productId, pages: info.numPages, ms: Date.now() - started }, 'PDF analysed');
}

/** Removes a superseded original PDF and everything generated from it. */
export async function removeOriginalAndDerived(productId: string, originalId: Types.ObjectId): Promise<void> {
  const setId = originalId.toString();
  await Promise.all([
    storage().deletePrefix(storageKeys.licensedSet(productId, setId)),
    storage().deletePrefix(storageKeys.sampleSet(productId, setId)),
    storage().deletePrefix(storageKeys.legacyPageSet(productId, setId)),
    ProductAsset.deleteMany({ sourceAssetId: originalId }),
  ]);
  const original = await ProductAsset.findOneAndDelete({ _id: originalId, kind: 'original_pdf' });
  if (original) await storage().delete(original.storageKey);
}

/** Automatic retries allowed after a restart; beyond this an admin must press "Try again". */
const MAX_AUTO_ATTEMPTS = 2;

/**
 * Re-queues work interrupted by a restart. A book that has already been attempted
 * MAX_AUTO_ATTEMPTS times is marked failed instead, so a bad file cannot cause a restart loop.
 */
export async function resumePendingProcessing(): Promise<void> {
  const pending = await Product.find({ 'processing.status': { $in: ['queued', 'processing'] } }).select('_id processing');
  for (const p of pending) {
    if ((p.processing?.attempts ?? 0) >= MAX_AUTO_ATTEMPTS) {
      await Product.updateOne(
        { _id: p._id },
        { $set: { 'processing.status': 'failed', 'processing.error': friendlyError(new Error('stopped unexpectedly')), 'processing.updatedAt': new Date() } },
      );
      logger.warn({ productId: p._id }, 'PDF processing abandoned after repeated failures');
      continue;
    }
    void enqueueProcessing(p._id.toString());
  }
  if (pending.length) logger.info({ count: pending.length }, 'Resumed PDF processing');
}
