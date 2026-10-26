import { personalizePdf } from '../../lib/pdf/stamp';
import { storage, storageKeys } from '../../lib/storage';
import { ProductAsset } from '../../models/ProductAsset';
import type { ProductDoc } from '../../models/Product';
import type { UserDoc } from '../../models/User';

const SITE_NAME = 'ReadnShare';

/**
 * Stamping loads the whole PDF into memory, so copies are generated one at a time. Each copy
 * is cached in private storage, so this work happens once per buyer per uploaded file.
 */
let chain: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.catch(() => undefined);
  return run;
}

async function cached(key: string, build: () => Promise<Uint8Array>): Promise<string> {
  if (await storage().exists(key)) return key;
  return oneAtATime(async () => {
    // Another request may have built it while this one waited its turn.
    if (await storage().exists(key)) return key;
    const bytes = await build();
    await storage().put(key, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), 'application/pdf');
    return key;
  });
}

async function originalBytes(product: ProductDoc): Promise<Uint8Array> {
  const asset = await ProductAsset.findById(product.pageSetId);
  if (!asset) throw new Error('Original PDF missing');
  return new Uint8Array(await storage().getBuffer(asset.storageKey));
}

/** Storage key of the buyer's personal, watermarked copy (created on first open). */
export function licensedCopyKey(product: ProductDoc, user: UserDoc, orderNumber: string | null): Promise<string> {
  const key = storageKeys.licensed(product._id.toString(), product.pageSetId!.toString(), user._id.toString());
  return cached(key, async () =>
    personalizePdf(await originalBytes(product), {
      email: user.email,
      orderNumber,
      title: product.title,
      author: product.author ?? '',
      siteName: SITE_NAME,
    }),
  );
}

