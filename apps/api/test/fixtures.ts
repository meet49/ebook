import { PDFDocument, StandardFonts } from 'pdf-lib';
import sharp from 'sharp';

export async function makePdf(pages: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([420, 595]);
    page.drawText(`Chapter ${i}`, { x: 40, y: 520, size: 28, font });
  }
  return Buffer.from(await doc.save());
}

export function makeImage(width = 600, height = 900): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 79, g: 70, b: 229 } } }).png().toBuffer();
}

/** Page count and all text of a PDF, for checking watermarks. */
export async function pdfText(bytes: Buffer | Uint8Array): Promise<{ pages: number; text: string }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const doc = await task.promise;
  let text = '';
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    text += content.items.map((i) => ('str' in i ? i.str : '')).join(' ') + '\n';
  }
  const pages = doc.numPages;
  await task.destroy();
  return { pages, text };
}

/** Collects a binary supertest response body. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supertest passes the raw response stream
export function binary(res: any, cb: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}
