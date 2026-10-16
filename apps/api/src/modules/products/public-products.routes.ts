import { Router, type Request } from 'express';
import { catalogQuerySchema, type ProductSort } from '@ebook/shared';
import { notFound } from '../../lib/errors';
import { sampleImage } from '../../lib/images';
import { sendBuffer, sendObject } from '../../lib/serve';
import { storage } from '../../lib/storage';
import { parse } from '../../middleware/validate';
import { Product, type ProductDoc } from '../../models/Product';
import { ProductAsset } from '../../models/ProductAsset';
import { availablePreviewPages, toDetail, toSummary } from './products.service';

export const publicProductsRouter = Router();

/** Only published products are ever visible publicly. */
const PUBLISHED = { status: 'published' } as const;

const SORTS: Record<ProductSort, Record<string, 1 | -1>> = {
  featured: { featured: -1, publishedAt: -1, _id: -1 },
  newest: { publishedAt: -1, _id: -1 },
  price_asc: { effectivePricePaise: 1, _id: -1 },
  price_desc: { effectivePricePaise: -1, _id: -1 },
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function loadPublished(req: Request): Promise<ProductDoc> {
  const product = await Product.findOne({ ...PUBLISHED, slug: String(req.params.slug).toLowerCase() });
  if (!product) throw notFound('eBook not found');
  return product;
}

publicProductsRouter.get('/', async (req, res) => {
  const { q, category, sort, featured, page, pageSize } = parse(catalogQuerySchema, req.query);
  const filter: Record<string, unknown> = { ...PUBLISHED };
  if (category) filter.categories = category;
  if (featured !== undefined) filter.featured = featured;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { subtitle: rx }, { author: rx }, { categories: rx }];
  }
  const [items, total] = await Promise.all([
    Product.find(filter).sort(SORTS[sort]).skip((page - 1) * pageSize).limit(pageSize),
    Product.countDocuments(filter),
  ]);
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.json({ items: items.map(toSummary), page, pageSize, total });
});

publicProductsRouter.get('/categories', async (_req, res) => {
  const categories = (await Product.distinct('categories', PUBLISHED)) as string[];
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({ categories: categories.filter(Boolean).sort((a, b) => a.localeCompare(b)) });
});

publicProductsRouter.get('/:slug', async (req, res) => {
  const product = await loadPublished(req);
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.json({ product: toDetail(product) });
});

publicProductsRouter.get('/:slug/cover', async (req, res) => {
  const product = await loadPublished(req);
  const asset = product.coverAssetId ? await ProductAsset.findById(product.coverAssetId) : null;
  if (!asset) throw notFound('No cover');
  // URLs carry ?v=<assetId>, so a new upload gets a new URL and old ones can be cached for long.
  await sendObject(res, asset.storageKey, 'image/webp', 'public, max-age=86400');
});

/** Public sample pages: only pages the admin marked as previews, downscaled and watermarked. */
publicProductsRouter.get('/:slug/samples/:page', async (req, res) => {
  const product = await loadPublished(req);
  const page = Number(req.params.page);
  if (!Number.isInteger(page) || !availablePreviewPages(product).includes(page)) throw notFound('Sample not available');
  const asset = await ProductAsset.findOne({ sourceAssetId: product.pageSetId, kind: 'page_image', page });
  if (!asset) throw notFound('Sample not available');
  const image = await sampleImage(await storage().getBuffer(asset.storageKey), 'SAMPLE');
  await sendBuffer(res, image, 'image/webp', 'public, max-age=3600');
});
