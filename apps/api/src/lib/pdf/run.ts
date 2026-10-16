import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderPdf, type RenderMeta, type RenderedPage } from './render';

export type { RenderMeta, RenderedPage } from './render';

/** Heap cap for the renderer process (MB). */
const RENDER_HEAP_MB = Number(process.env.PDF_RENDER_HEAP_MB) || 192;

/** Tests render inline (Vitest cannot run TypeScript child processes). */
const INLINE = process.env.NODE_ENV === 'test';

// In development this module is src/lib/pdf/run.ts, next to src/workers/ (run through tsx);
// in the production bundle everything lives in dist/server.js, next to dist/workers/.
const isSource = import.meta.url.endsWith('.ts');
const childPath = fileURLToPath(
  isSource ? new URL('../../workers/pdf-render.worker.ts', import.meta.url) : new URL('./workers/pdf-render.worker.js', import.meta.url),
);

/**
 * Renders a PDF page by page in a short-lived child process. Pages stream back one at a time;
 * the child waits for an ack before rendering the next, so memory stays bounded.
 */
export function renderPdfPages(
  data: Uint8Array,
  width: number,
  onPage: (page: RenderedPage) => Promise<void>,
  onMeta: (meta: RenderMeta) => Promise<void>,
): Promise<RenderMeta> {
  if (INLINE) return renderPdf(data, width, onPage, onMeta);

  return new Promise((resolve, reject) => {
    const child = fork(childPath, [], {
      serialization: 'advanced',
      // A tight heap makes V8 collect decoded page images promptly (the API's own heap flag is not inherited).
      execArgv: [...(isSource ? ['--import', 'tsx'] : []), `--max-old-space-size=${RENDER_HEAP_MB}`],
      env: { ...process.env, NODE_OPTIONS: '' },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    let settled = false;
    const finish = (err: Error | null, meta?: RenderMeta) => {
      if (settled) return;
      settled = true;
      if (child.connected) child.kill();
      if (err) reject(err);
      else resolve(meta!);
    };

    // Messages are handled strictly in order: each page is stored before the next is rendered.
    let chain = Promise.resolve();
    child.on('message', (msg: { type: string; page?: RenderedPage; meta?: RenderMeta; message?: string }) => {
      chain = chain
        .then(async () => {
          if (settled) return;
          if (msg.type === 'meta') await onMeta(msg.meta!);
          else if (msg.type === 'page') {
            await onPage(msg.page!);
            child.send('ack');
          } else if (msg.type === 'done') finish(null, msg.meta);
          else if (msg.type === 'error') finish(new Error(msg.message));
        })
        .catch((err: Error) => finish(err));
    });
    child.on('error', (err) => finish(err));
    child.on('exit', (code, signal) => {
      // Let any queued "done" message be handled first.
      void chain.then(() => {
        if (signal === 'SIGKILL') finish(new Error('PDF renderer ran out of memory'));
        else finish(new Error(`PDF renderer stopped unexpectedly (${signal ?? `exit code ${code}`})`));
      });
    });

    child.send({ type: 'start', data, width });
  });
}
