import { env } from '../../config/env';
import { LocalStorage } from './local';
import { S3Storage } from './s3';
import type { ObjectStorage } from './types';

export { ObjectNotFoundError, type ObjectStorage } from './types';

let instance: ObjectStorage | null = null;

export function storage(): ObjectStorage {
  instance ??=
    env.STORAGE_DRIVER === 's3'
      ? new S3Storage({
          endpoint: env.S3_ENDPOINT,
          region: env.S3_REGION,
          bucket: env.S3_BUCKET!,
          accessKeyId: env.S3_ACCESS_KEY_ID!,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
          forcePathStyle: env.S3_FORCE_PATH_STYLE,
        })
      : new LocalStorage(env.STORAGE_DIR);
  return instance;
}

/** Test hook. */
export function setStorage(next: ObjectStorage): void {
  instance = next;
}

export const storageKeys = {
  original: (productId: string, assetId: string) => `products/${productId}/original/${assetId}.pdf`,
  cover: (productId: string, assetId: string) => `products/${productId}/cover/${assetId}.webp`,
  /** A buyer's personal, watermarked copy of one uploaded PDF. */
  licensed: (productId: string, setId: string, userId: string) => `products/${productId}/licensed/${setId}/${userId}.pdf`,
  licensedSet: (productId: string, setId: string) => `products/${productId}/licensed/${setId}/`,
  /** Public sample built from the chosen preview pages. */
  sample: (productId: string, setId: string, pages: number[]) => `products/${productId}/samples/${setId}/${pages.join('-')}.pdf`,
  sampleSet: (productId: string, setId: string) => `products/${productId}/samples/${setId}/`,
  /** Page images from the earlier rendering pipeline (cleaned up on re-upload). */
  legacyPageSet: (productId: string, setId: string) => `products/${productId}/pages/${setId}/`,
};
