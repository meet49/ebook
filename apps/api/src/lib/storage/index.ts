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
  page: (productId: string, setId: string, page: number) => `products/${productId}/pages/${setId}/${page}.webp`,
  pageSet: (productId: string, setId: string) => `products/${productId}/pages/${setId}/`,
};
