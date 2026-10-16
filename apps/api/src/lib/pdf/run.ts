import { Worker } from 'node:worker_threads';
import { renderPdf, type RenderMeta, type RenderedPage } from './render';

export type { RenderMeta, RenderedPage } from './render';

/** Tests render inline (Vitest cannot load TypeScript worker files). */
const INLINE = process.env.NODE_ENV === 'test';

// In development this module is src/lib/pdf/run.ts next to src/workers/; in the production
// bundle everything lives in dist/server.js next to dist/workers/.
const workerUrl = import.meta.url.endsWith('.ts')
  ? new URL('../../workers/dev-bootstrap.mjs', import.meta.url)
  : new URL('./workers/pdf-render.worker.js', import.meta.url);

/** Renders a PDF page by page, off the main thread. */
export function renderPdfPages(
  data: Uint8Array,
  width: number,
  onPage: (page: RenderedPage) => Promise<void>,
  onMeta: (meta: RenderMeta) => Promise<void>,
): Promise<RenderMeta> {
  if (INLINE) return renderPdf(data, width, onPage, onMeta);

  return new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl, { workerData: { data, width } });
    let settled = false;
    const finish = (err: Error | null, meta?: RenderMeta) => {
      if (settled) return;
      settled = true;
      void worker.terminate();
      if (err) reject(err);
      else resolve(meta!);
    };

    // Messages are handled strictly in order: each page is stored before the worker renders the next.
    let chain = Promise.resolve();
    worker.on('message', (msg: { type: string; page?: RenderedPage; meta?: RenderMeta; message?: string }) => {
      chain = chain
        .then(async () => {
          if (settled) return;
          if (msg.type === 'meta') await onMeta(msg.meta!);
          else if (msg.type === 'page') {
            await onPage(msg.page!);
            worker.postMessage('ack');
          } else if (msg.type === 'done') finish(null, msg.meta);
          else if (msg.type === 'error') finish(new Error(msg.message));
        })
        .catch((err: Error) => finish(err));
    });
    worker.on('error', (err) => finish(err));
    worker.on('exit', (code) => {
      if (code !== 0) finish(new Error(`PDF renderer exited with code ${code}`));
    });
  });
}
