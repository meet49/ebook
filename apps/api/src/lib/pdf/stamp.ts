import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

/** The standard PDF fonts only cover Latin-1 (WinAnsi); replace anything else so stamping never fails. */
function winAnsi(text: string): string {
  return text.replace(/[^\x20-\x7E -ÿ–—•]/g, '?');
}

/** Largest font size (up to `max`) at which `text` fits into `width`. */
function fitSize(font: PDFFont, text: string, width: number, max: number, min = 4): number {
  let size = max;
  while (size > min && font.widthOfTextAtSize(text, size) > width) size -= 0.25;
  return size;
}

/** Draws text along the bottom edge and a faint diagonal pattern across the page. */
function stampPage(page: PDFPage, font: PDFFont, bold: PDFFont, footer: string, pattern: string, patternOpacity: number) {
  const { width, height } = page.getSize();
  const margin = Math.max(8, width * 0.03);

  const footerSize = fitSize(font, footer, width - margin * 2, 7.5);
  page.drawText(footer, {
    x: (width - font.widthOfTextAtSize(footer, footerSize)) / 2,
    y: Math.max(4, height * 0.012),
    size: footerSize,
    font,
    color: rgb(0.32, 0.3, 0.55),
    opacity: 0.75,
  });

  const patternSize = Math.max(10, width / 26);
  const step = patternSize * 7;
  for (let row = 0, y = -height * 0.1; y < height * 1.1; row++, y += step) {
    const x = row % 2 === 0 ? width * 0.08 : width * 0.38;
    page.drawText(pattern, { x, y, size: patternSize, font: bold, color: rgb(0.2, 0.18, 0.45), opacity: patternOpacity, rotate: degrees(32) });
  }
}

export interface LicenseInfo {
  email: string;
  orderNumber: string | null;
  title: string;
  author: string;
  siteName: string;
}

/**
 * Returns a personal copy of the book: every page carries the buyer's email and order number
 * (footer + faint diagonal pattern), plus a copyright line, and the document metadata names
 * the licensee. This is a deterrent and makes leaks traceable; it cannot stop a determined
 * expert from editing the file.
 */
export async function personalizePdf(original: Uint8Array, info: LicenseInfo): Promise<Uint8Array> {
  const doc = await PDFDocument.load(original, { updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const year = new Date().getFullYear();
  const footer = winAnsi(
    `Licensed to ${info.email}${info.orderNumber ? ` - Order ${info.orderNumber}` : ''} - (c) ${year} ${info.siteName}. ` +
      'Unauthorized copying, sharing or resale is prohibited and traceable.',
  );
  const pattern = winAnsi(info.email);
  for (const page of doc.getPages()) stampPage(page, font, bold, footer, pattern, 0.07);

  doc.setTitle(winAnsi(info.title));
  if (info.author) doc.setAuthor(winAnsi(info.author));
  doc.setSubject(winAnsi(`Licensed to ${info.email}${info.orderNumber ? ` (order ${info.orderNumber})` : ''}`));
  doc.setKeywords([winAnsi(`licensed:${info.email}`), winAnsi(info.siteName)]);
  doc.setProducer(winAnsi(info.siteName));
  doc.setCreator(winAnsi(info.siteName));
  return doc.save({ useObjectStreams: true });
}
