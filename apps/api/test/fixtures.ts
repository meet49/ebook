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
