// Development only: worker threads do not inherit tsx's loader from the main thread, so
// register it here before loading the TypeScript worker. Production runs the bundled .js.
import { register } from 'tsx/esm/api';

register();
await import('./pdf-render.worker.ts');
