import { createRequire } from 'node:module';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

export interface PdfInfo {
  numPages: number;
  /** First page size in PDF points; the reader uses it for the page aspect ratio. */
  pageWidth: number;
  pageHeight: number;
  toc: { title: string; page: number }[];
}

const require = createRequire(import.meta.url);
const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
const CMAPS = path.join(pdfjsRoot, 'cmaps').split(path.sep).join('/') + '/';

/** Guards the server against absurdly long uploads. */
const MAX_PAGES = 2000;

type PdfDocument = Awaited<ReturnType<typeof import('pdfjs-dist/legacy/build/pdf.mjs')['getDocument']>['promise']>;

/**
 * Reads what the store needs from an uploaded PDF — page count, page size and the bookmark
 * outline — without rendering anything, so even large books need little memory. Also checks
 * the file can be watermarked later (e.g. it is not password-protected).
 */
export async function analyzePdf(data: Uint8Array): Promise<PdfInfo> {
  // pdf-lib must be able to open the file, because every buyer's copy is stamped with it.
  try {
    await PDFDocument.load(data.slice(), { updateMetadata: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(/encrypt/i.test(msg) ? 'password-protected PDF' : `Invalid PDF: ${msg}`);
  }

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: data.slice(), disableFontFace: true, cMapUrl: CMAPS, cMapPacked: true, verbosity: 0 });
  const doc = await task.promise;
  try {
    if (doc.numPages > MAX_PAGES) throw new Error(`PDF has ${doc.numPages} pages; the maximum is ${MAX_PAGES}`);
    const first = (await doc.getPage(1)).getViewport({ scale: 1 });
    return { numPages: doc.numPages, pageWidth: first.width, pageHeight: first.height, toc: await extractToc(doc) };
  } finally {
    await task.destroy();
  }
}

/** Converts the PDF outline (bookmarks) into a flat table of contents, two levels deep. */
async function extractToc(doc: PdfDocument): Promise<PdfInfo['toc']> {
  const outline = await doc.getOutline().catch(() => null);
  if (!outline) return [];

  const toc: PdfInfo['toc'] = [];
  const visit = async (items: typeof outline, depth: number) => {
    for (const item of items) {
      const page = await resolvePage(doc, item.dest);
      const title = item.title?.trim();
      if (title && page) toc.push({ title: depth > 0 ? `— ${title}` : title, page });
      if (depth === 0 && item.items?.length) await visit(item.items, 1);
      if (toc.length >= 300) return;
    }
  };
  await visit(outline, 0);
  return toc;
}

async function resolvePage(doc: PdfDocument, dest: unknown): Promise<number | null> {
  try {
    const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : (dest as unknown[] | null);
    const ref = explicit?.[0];
    if (ref == null) return null;
    if (typeof ref === 'number') return ref + 1;
    return (await doc.getPageIndex(ref as never)) + 1;
  } catch {
    return null;
  }
}
