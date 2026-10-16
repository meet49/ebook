/**
 * Child-process entry that renders one PDF, then exits. Running in a separate process (not a
 * worker thread) means all native memory used by pdfjs/canvas is returned to the OS when the
 * book is done, and if memory ever runs out the kernel kills this process instead of the API.
 *
 * Protocol over IPC (advanced serialization):
 *   parent -> child: {type:'start', data, width}, then 'ack' after each page
 *   child -> parent: {type:'meta', meta} once, {type:'page', page} per page,
 *                    then {type:'done', meta} or {type:'error', message}
 */
import { renderPdf } from '../lib/pdf/render';

interface StartMessage {
  type: 'start';
  data: Uint8Array;
  width: number;
}

const send = (msg: unknown) =>
  new Promise<void>((resolve, reject) => process.send!(msg, undefined, {}, (err) => (err ? reject(err) : resolve())));

let ackWaiter: (() => void) | null = null;

process.on('message', (msg: StartMessage | 'ack') => {
  if (msg === 'ack') {
    ackWaiter?.();
    ackWaiter = null;
    return;
  }
  if (msg?.type !== 'start') return;

  renderPdf(
    msg.data,
    msg.width,
    async (page) => {
      const acked = new Promise<void>((resolve) => (ackWaiter = resolve));
      await send({ type: 'page', page });
      await acked;
    },
    (meta) => send({ type: 'meta', meta }),
  )
    .then((meta) => send({ type: 'done', meta }))
    .catch((err: unknown) => send({ type: 'error', message: err instanceof Error ? err.message : String(err) }))
    .finally(() => process.exit(0));
});

// If the API goes away, don't linger.
process.on('disconnect', () => process.exit(0));
