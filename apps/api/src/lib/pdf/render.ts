import { createRequire } from 'node:module';
import v8 from 'node:v8';
import vm from 'node:vm';
import path from 'node:path';

export interface RenderedPage {
  page: number;
  /** The page as a WebP image. */
  webp: Uint8Array;
  width: number;
  height: number;
}

export interface RenderMeta {
  numPages: number;
  toc: { title: string; page: number }[];
}

const require = createRequire(import.meta.url);

/**
 * Decoded page images are large ArrayBuffers that V8 frees lazily; on a 512 MB server that
 * laziness alone can exhaust memory mid-book. Forcing a collection after each page keeps the
 * peak close to a single page's working set.
 */
v8.setFlagsFromString('--expose-gc');
const collectGarbage = vm.runInNewContext('gc') as (() => void) | undefined;
const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
// pdfjs needs these to render documents that rely on the 14 standard fonts or CJK encodings.
// In Node it reads them with fs, so pass a plain path (not a file:// URL), with forward
// slashes and a trailing slash — pdfjs rejects Windows backslash paths.
const dataDir = (name: string) => path.join(pdfjsRoot, name).split(path.sep).join('/') + '/';
const STANDARD_FONTS = dataDir('standard_fonts');
const CMAPS = dataDir('cmaps');

const WEBP_QUALITY = 80;

/** Guards the server against absurdly long uploads. */
const MAX_PAGES = 2000;

type PdfDocument = Awaited<ReturnType<typeof import('pdfjs-dist/legacy/build/pdf.mjs')['getDocument']>['promise']>;

/**
 * Rasterises every page of a PDF to PNG at a fixed width. `onPage` is awaited before the next
 * page renders, so memory stays bounded to one page regardless of document length.
 */
export async function renderPdf(
  data: Uint8Array,
  width: number,
  onPage: (page: RenderedPage) => Promise<void>,
  onMeta?: (meta: RenderMeta) => Promise<void> | void,
): Promise<RenderMeta> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createCanvas } = await import('@napi-rs/canvas');

  const task = pdfjs.getDocument({
    data,
    disableFontFace: true,
    standardFontDataUrl: STANDARD_FONTS,
    cMapUrl: CMAPS,
    cMapPacked: true,
    verbosity: 0,
  });
  const doc = await task.promise;

  try {
    if (doc.numPages > MAX_PAGES) throw new Error(`PDF has ${doc.numPages} pages; the maximum is ${MAX_PAGES}`);
    const meta: RenderMeta = { numPages: doc.numPages, toc: await extractToc(doc) };
    await onMeta?.(meta);

    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / base.width });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext('2d');
      // White background: PDFs are transparent by default.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas: canvas as never, canvasContext: ctx as never, viewport }).promise;
      // Encode straight to WebP (no PNG intermediate); copy into a standalone, transferable buffer.
      const webp = new Uint8Array(await canvas.encode('webp', WEBP_QUALITY));
      const { width: w, height: h } = canvas;
      page.cleanup();
      await doc.cleanup();
      collectGarbage?.();
      await onPage({ page: n, webp, width: w, height: h });
    }
    return meta;
  } finally {
    await task.destroy();
  }
}

/** Converts the PDF outline (bookmarks) into a flat table of contents, two levels deep. */
async function extractToc(doc: PdfDocument): Promise<RenderMeta['toc']> {
  const outline = await doc.getOutline().catch(() => null);
  if (!outline) return [];

  const toc: RenderMeta['toc'] = [];
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
