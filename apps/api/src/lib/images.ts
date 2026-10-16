import sharp from 'sharp';

// Small servers: no libvips operation cache, one thread. Throughput barely matters here.
sharp.cache(false);
sharp.concurrency(1);
import { badRequest } from './errors';

const COVER_FORMATS = new Set(['jpeg', 'png', 'webp']);

/**
 * Validates an uploaded cover by decoding it (not by trusting the filename or MIME type),
 * then re-encodes it to WebP. Re-encoding strips metadata and any embedded payloads.
 */
export async function processCover(input: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw badRequest('The cover must be a JPG, PNG or WebP image');
  }
  if (!meta.format || !COVER_FORMATS.has(meta.format)) throw badRequest('The cover must be a JPG, PNG or WebP image');
  if ((meta.width ?? 0) < 300 || (meta.height ?? 0) < 400) {
    throw badRequest('The cover should be at least 300 × 400 pixels (recommended 1200 × 1800)');
  }

  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: 1200, height: 1800, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

