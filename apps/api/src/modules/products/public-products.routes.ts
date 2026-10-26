import { Router, type Request } from 'express';
import { catalogQuerySchema, type ProductSort } from '@ebook/shared';
import { notFound } from '../../lib/errors';
import { sendObject } from '../../lib/serve';
import { parse } from '../../middleware/validate';
import { Product, type ProductDoc } from '../../models/Product';
import { ProductAsset } from '../../models/ProductAsset';
import { comboCandidates } from '../checkout/pricing';
import { toDetail, toSummary } from './products.service';

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
  // Not personalised (the response is cached publicly); checkout hides books the buyer owns.
  const addOns = await comboCandidates(product.categories, [product._id], null, 3);
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.json({ product: toDetail(product, addOns) });
});

publicProductsRouter.get('/:slug/cover', async (req, res) => {
  const product = await loadPublished(req);
  const asset = product.coverAssetId ? await ProductAsset.findById(product.coverAssetId) : null;
  if (!asset) throw notFound('No cover');
  // URLs carry ?v=<assetId>, so a new upload gets a new URL and old ones can be cached for long.
  await sendObject(res, asset.storageKey, 'image/webp', 'public, max-age=86400');
});
