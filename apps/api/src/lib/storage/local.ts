import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ObjectNotFoundError, assertSafeKey, type ObjectStorage } from './types';

/** Development storage in a private directory outside any web root. */
export class LocalStorage implements ObjectStorage {
  private readonly root: string;

  constructor(dir: string) {
    this.root = path.resolve(dir);
  }

  private resolve(key: string): string {
    assertSafeKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error(`Unsafe storage key: ${key}`);
    return full;
  }

  async put(key: string, body: Buffer | Readable): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    if (Buffer.isBuffer(body)) await writeFile(file, body);
    else await pipeline(body, createWriteStream(file));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async getStream(key: string): Promise<Readable> {
    const file = this.resolve(key);
    await this.assertExists(file, key);
    return createReadStream(file);
  }

  async getBuffer(key: string): Promise<Buffer> {
    const file = this.resolve(key);
    await this.assertExists(file, key);
    return readFile(file);
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async deletePrefix(prefix: string): Promise<void> {
    await rm(this.resolve(prefix.replace(/\/+$/, '')), { recursive: true, force: true });
  }

  private async assertExists(file: string, key: string): Promise<void> {
    try {
      await stat(file);
    } catch {
      throw new ObjectNotFoundError(key);
    }
  }
}
