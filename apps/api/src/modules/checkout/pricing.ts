import type { Types } from 'mongoose';
import { intlComboCents, type DisplayCurrency } from '@ebook/shared';
import { badRequest } from '../../lib/errors';
import { centsToPaise, usdToInrRate } from '../../lib/fx';
import { CouponError, applyCoupon, loadUsableCoupon, type AppliedCoupon } from './coupons';
import { Entitlement } from '../../models/Entitlement';
import { Order } from '../../models/Order';
import { Product, type ProductDoc } from '../../models/Product';

/** How long after a purchase same-category books stay available at their combo price. */
export const COMBO_WINDOW_MS = 24 * 60 * 60_000;
/** Most extra books that can be added to one order. */
export const MAX_ADD_ONS = 3;

export interface PricedLine {
  product: ProductDoc;
  /** INR (paise): what the book costs on its own and what is charged for it. */
  listPricePaise: number;
  pricePaise: number;
  combo: boolean;
  /** What the buyer sees, in the display currency's minor unit (paise or cents). */
  displayListMinor: number;
  displayPriceMinor: number;
  /** Coupon discount already taken off pricePaise, and off displayPriceMinor. */
  couponDiscountPaise?: number;
  couponDisplayMinor?: number;
}

export interface PricedOrder {
  lines: PricedLine[];
  /** Always charged in INR. */
  totalPaise: number;
  currency: DisplayCurrency;
  totalDisplayMinor: number;
  /** INR per USD used, when the currency is USD. */
  fxRate: number | null;
  coupon: AppliedCoupon | null;
  /** Set (instead of throwing) when a coupon could not be applied and `lenientCoupon` was asked for. */
  couponError: string | null;
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
export async function priceOrder(
  product: ProductDoc,
  addOnSlugs: string[],
  userId: Types.ObjectId | null,
  opts: { international?: boolean; couponCode?: string; lenientCoupon?: boolean } = {},
): Promise<PricedOrder> {
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
  const mainPrice = expires ? product.comboPricePaise! : product.effectivePricePaise;
  const main: PricedLine = {
    product,
    listPricePaise: product.effectivePricePaise,
    pricePaise: mainPrice,
    combo: Boolean(expires),
    displayListMinor: product.effectivePricePaise,
    displayPriceMinor: mainPrice,
  };
  // Keep the order the buyer chose.
  const extra = slugs.map((slug) => addOns.find((a) => a.slug === slug)!).map<PricedLine>((p) => ({
    product: p,
    listPricePaise: p.effectivePricePaise,
    pricePaise: p.comboPricePaise!,
    combo: true,
    displayListMinor: p.effectivePricePaise,
    displayPriceMinor: p.comboPricePaise!,
  }));

  let lines = [main, ...extra];
  let currency: DisplayCurrency = 'INR';
  let fxRate: number | null = null;
  if (opts.international) {
    const usd = await internationalLines(lines);
    if (usd) {
      lines = usd.lines;
      fxRate = usd.fxRate;
      currency = 'USD';
    }
  }
  let coupon: AppliedCoupon | null = null;
  let couponError: string | null = null;
  if (opts.couponCode?.trim()) {
    try {
      const applied = applyCoupon(await loadUsableCoupon(opts.couponCode, userId), lines);
      lines = applied.lines;
      coupon = applied.applied;
    } catch (err) {
      if (!(err instanceof CouponError) || !opts.lenientCoupon) throw err;
      couponError = err.message;
    }
  }
  return {
    lines,
    totalPaise: lines.reduce((s, l) => s + l.pricePaise, 0),
    coupon,
    couponError,
    currency,
    totalDisplayMinor: lines.reduce((s, l) => s + l.displayPriceMinor, 0),
    fxRate,
    offerExpiresAt: expires,
  };
}

/**
 * Re-prices lines in USD for visitors outside India, charged in INR at today's rate. Only when
 * every book has an international price and a rate is available; otherwise the INR prices stand.
 */
async function internationalLines(lines: PricedLine[]): Promise<{ lines: PricedLine[]; fxRate: number } | null> {
  const usd = lines.map((l) => {
    const p = l.product;
    if (p.intlPriceCents == null) return null;
    const combo = intlComboCents({
      intlPriceCents: p.intlPriceCents,
      intlComboPriceCents: p.intlComboPriceCents ?? null,
      comboPricePaise: p.comboPricePaise ?? null,
      effectivePricePaise: p.effectivePricePaise,
    });
    const price = l.combo ? combo : p.intlPriceCents;
    return price == null ? null : { list: p.intlPriceCents, price };
  });
  if (usd.some((u) => u === null)) return null;
  const rate = await usdToInrRate();
  if (!rate) return null;
  return {
    fxRate: rate,
    lines: lines.map((l, i) => ({
      ...l,
      listPricePaise: centsToPaise(usd[i]!.list, rate),
      pricePaise: centsToPaise(usd[i]!.price, rate),
      displayListMinor: usd[i]!.list,
      displayPriceMinor: usd[i]!.price,
    })),
  };
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
