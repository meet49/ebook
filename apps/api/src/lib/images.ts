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

function sampleOverlay(width: number, height: number, label: string): Buffer {
  const fontSize = Math.round(width / 18);
  const rows = Math.ceil(height / (fontSize * 6)) + 2;
  const lines = Array.from({ length: rows }, (_, i) => {
    const y = i * fontSize * 6;
    return `<text x="${width / 2}" y="${y}" text-anchor="middle">${label}</text>`;
  }).join('');
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <g transform="rotate(-30 ${width / 2} ${height / 2})" fill="rgba(79,70,229,0.13)"
         font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700">${lines}</g>
    </svg>`,
  );
}

/** Downscaled, watermarked rendition for public sample pages. */
export async function sampleImage(page: Buffer, label: string): Promise<Buffer> {
  const resized = await sharp(page).resize({ width: 1000, withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
  return sharp(resized.data)
    .composite([{ input: sampleOverlay(resized.info.width, resized.info.height, label) }])
    .webp({ quality: 72 })
    .toBuffer();
}
