/**
 * Worker thread entry: renders a PDF off the main event loop so API requests stay fast
 * while a book is processed. Protocol (worker -> parent):
 *   {type:'meta', meta} once, then {type:'page', page} per page (waits for an 'ack'),
 *   then {type:'done', meta} or {type:'error', message}.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { renderPdf } from '../lib/pdf/render';

interface Input {
  data: Uint8Array;
  width: number;
}

const port = parentPort!;
const { data, width } = workerData as Input;

function waitForAck(): Promise<void> {
  return new Promise((resolve) => port.once('message', () => resolve()));
}

renderPdf(
  data,
  width,
  async (page) => {
    port.postMessage({ type: 'page', page }, [page.png.buffer as ArrayBuffer]);
    await waitForAck();
  },
  (meta) => port.postMessage({ type: 'meta', meta }),
)
  .then((meta) => port.postMessage({ type: 'done', meta }))
  .catch((err: unknown) => port.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) }));
