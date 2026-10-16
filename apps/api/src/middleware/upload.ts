import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import os from 'node:os';
import multer from 'multer';
import { env } from '../config/env';

/** PDFs are spooled to a temp file (they can be hundreds of MB); covers are small and kept in memory. */
export const pdfUpload = multer({
  storage: multer.diskStorage({ destination: os.tmpdir() }),
  limits: { fileSize: env.MAX_PDF_MB * 1024 * 1024, files: 1, fields: 5 },
}).single('file');

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_COVER_MB * 1024 * 1024, files: 1, fields: 5 },
}).single('file');

/** Checks the file signature rather than trusting the browser-supplied MIME type or extension. */
export async function isPdfFile(path: string): Promise<boolean> {
  const fh = await open(path, 'r');
  try {
    const buf = Buffer.alloc(1024);
    const { bytesRead } = await fh.read(buf, 0, 1024, 0);
    // The header must appear within the first 1024 bytes per the PDF spec.
    return buf.subarray(0, bytesRead).includes('%PDF-');
  } finally {
    await fh.close();
  }
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

export async function removeTemp(path: string | undefined): Promise<void> {
  if (path) await unlink(path).catch(() => {});
}
