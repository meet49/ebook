import type { Types } from 'mongoose';
import { badRequest } from '../../lib/errors';
import { Entitlement } from '../../models/Entitlement';
import { Order } from '../../models/Order';
import { Product, type ProductDoc } from '../../models/Product';

/** How long after a purchase same-category books stay available at their combo price. */
export const COMBO_WINDOW_MS = 24 * 60 * 60_000;
/** Most extra books that can be added to one order. */
export const MAX_ADD_ONS = 3;

export interface PricedLine {
  product: ProductDoc;
  listPricePaise: number;
  pricePaise: number;
  combo: boolean;
}

export interface PricedOrder {
  lines: PricedLine[];
  totalPaise: number;
  /** When the post-purchase combo price for the main book expires (null if it does not apply). */
  offerExpiresAt: Date | null;
}

const sharesCategory = (a: ProductDoc, b: { categories: string[] }) => a.categories.some((c) => b.categories.includes(c));

/** A book can be sold at its combo price only if it has one and it is really cheaper. */
const hasCombo = (p: ProductDoc) => p.comboPricePaise != null && p.comboPricePaise < p.effectivePricePaise;

/**
 * Categories the user bought into within the offer window, each with when its offer ends.
 * Only paid purchases count (entitlements linked to an order), not admin grants.
 */
export async function comboWindow(userId: Types.ObjectId | null | undefined): Promise<Map<string, Date>> {
  const window = new Map<string, Date>();
  if (!userId) return window;
  const since = new Date(Date.now() - COMBO_WINDOW_MS);
  const recent = await Entitlement.find({ userId, status: 'active', orderId: { $ne: null }, grantedAt: { $gte: since } }).select('productId grantedAt');
  if (!recent.length) return window;
  const products = await Product.find({ _id: { $in: recent.map((e) => e.productId) } }).select('categories');
  const categoriesBy = new Map(products.map((p) => [p._id.toString(), p.categories]));
  for (const e of recent) {
    const expires = new Date(e.grantedAt.getTime() + COMBO_WINDOW_MS);
    for (const c of categoriesBy.get(e.productId.toString()) ?? []) {
      const current = window.get(c);
      if (!current || current < expires) window.set(c, expires);
    }
  }
  return window;
}

function windowExpiry(product: ProductDoc, window: Map<string, Date>): Date | null {
  let best: Date | null = null;
  for (const c of product.categories) {
    const e = window.get(c);
    if (e && (!best || e > best)) best = e;
  }
  return best;
}

/**
 * Prices an order on the server. The main book costs its selling price, or its combo price
 * when the buyer bought a same-category book in the last 24 hours. Each add-on must share a
 * category with the main book and costs its combo price.
 */
export async function priceOrder(product: ProductDoc, addOnSlugs: string[], userId: Types.ObjectId | null): Promise<PricedOrder> {
  const slugs = [...new Set(addOnSlugs.map((s) => s.toLowerCase()))].filter((s) => s !== product.slug);
  if (slugs.length > MAX_ADD_ONS) throw badRequest(`You can add at most ${MAX_ADD_ONS} books to one order`);

  const addOns = slugs.length ? await Product.find({ slug: { $in: slugs }, status: 'published' }) : [];
  for (const slug of slugs) {
    const p = addOns.find((a) => a.slug === slug);
    if (!p || !hasCombo(p) || !sharesCategory(p, product)) {
      throw badRequest('One of the selected books can no longer be added as a combo. Please review your order.', { addOnSlugs: [slug] });
    }
  }

  const window = await comboWindow(userId);
  const expires = hasCombo(product) ? windowExpiry(product, window) : null;
  const main: PricedLine = {
    product,
    listPricePaise: product.effectivePricePaise,
    pricePaise: expires ? product.comboPricePaise! : product.effectivePricePaise,
    combo: Boolean(expires),
  };
  // Keep the order the buyer chose.
  const extra = slugs.map((slug) => addOns.find((a) => a.slug === slug)!).map<PricedLine>((p) => ({
    product: p,
    listPricePaise: p.effectivePricePaise,
    pricePaise: p.comboPricePaise!,
    combo: true,
  }));

  const lines = [main, ...extra];
  return { lines, totalPaise: lines.reduce((s, l) => s + l.pricePaise, 0), offerExpiresAt: expires };
}

/** Same-category books with a combo price that the user does not own yet. */
export async function comboCandidates(
  categories: string[],
  exclude: Types.ObjectId[],
  userId: Types.ObjectId | null,
  limit = 6,
): Promise<ProductDoc[]> {
  if (!categories.length) return [];
  const owned = userId ? await Entitlement.find({ userId, status: 'active' }).distinct('productId') : [];
  const candidates = await Product.find({
    status: 'published',
    categories: { $in: categories },
    comboPricePaise: { $ne: null },
    _id: { $nin: [...exclude, ...owned] },
  })
    .sort({ featured: -1, publishedAt: -1 })
    .limit(limit * 2);
  return candidates.filter(hasCombo).slice(0, limit);
}

/**
 * Offers shown after a purchase: books from the categories bought in the last 24 hours, at
 * their combo price, until the window closes.
 */
export async function offersForUser(userId: Types.ObjectId): Promise<{ expiresAt: Date | null; products: ProductDoc[] }> {
  const window = await comboWindow(userId);
  if (!window.size) return { expiresAt: null, products: [] };
  const products = await comboCandidates([...window.keys()], [], userId);
  const expiresAt = products.reduce<Date | null>((latest, p) => {
    const e = windowExpiry(p, window);
    return e && (!latest || e > latest) ? e : latest;
  }, null);
  return { expiresAt, products };
}

/** The buyer of a recent paid order, for showing their post-purchase offers by order number. */
export async function recentBuyerOf(orderNumber: string): Promise<Types.ObjectId | null> {
  const order = await Order.findOne({ orderNumber, status: { $in: ['paid', 'partially_refunded'] } }).select('userId paidAt');
  if (!order?.paidAt || Date.now() - order.paidAt.getTime() > COMBO_WINDOW_MS) return null;
  return order.userId;
}
