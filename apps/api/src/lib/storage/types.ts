import type { Readable } from 'node:stream';

/**
 * Private object storage. Keys are generated server-side only and are never sent to
 * browsers; files are always served through authorized API endpoints.
 */
export interface ObjectStorage {
  put(key: string, body: Buffer | Readable, contentType: string): Promise<void>;
  getStream(key: string): Promise<Readable>;
  getBuffer(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}

export class ObjectNotFoundError extends Error {
  constructor(key: string) {
    super(`Object not found: ${key}`);
    this.name = 'ObjectNotFoundError';
  }
}

/** Rejects keys that could escape the storage root or bucket prefix. */
export function assertSafeKey(key: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/._-]*$/.test(key) || key.includes('..') || key.includes('//')) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
}
