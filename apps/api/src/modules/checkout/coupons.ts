import type { Types } from 'mongoose';
import { HttpError } from '../../lib/errors';
import { Coupon, type CouponDoc } from '../../models/Coupon';
import { Order } from '../../models/Order';
import type { PricedLine } from './pricing';

/** Orders that count as a use of a coupon. */
const USED: ('paid' | 'partially_refunded')[] = ['paid', 'partially_refunded'];
/** No book ever costs less than ₹1 after a discount. */
const MIN_LINE_PAISE = 100;

export class CouponError extends HttpError {
  constructor(message: string) {
    super(400, 'INVALID_COUPON', message, { couponCode: [message] });
  }
}

/** Finds a coupon and checks it can be used now (and by this buyer, when known). */
export async function loadUsableCoupon(code: string, userId: Types.ObjectId | null): Promise<CouponDoc> {
  const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() });
  const now = new Date();
  if (!coupon || !coupon.active) throw new CouponError('This coupon code is not valid');
  if (coupon.startsAt && coupon.startsAt > now) throw new CouponError('This coupon is not active yet');
  if (coupon.endsAt && coupon.endsAt <= now) throw new CouponError('This coupon has expired');
  if (coupon.maxRedemptions != null) {
    const used = await Order.countDocuments({ 'coupon.couponId': coupon._id, status: { $in: USED } });
    if (used >= coupon.maxRedemptions) throw new CouponError('This coupon has been fully used');
  }
  if (userId && coupon.perUserLimit != null) {
    const mine = await Order.countDocuments({ 'coupon.couponId': coupon._id, userId, status: { $in: USED } });
    if (mine >= coupon.perUserLimit) throw new CouponError('You have already used this coupon');
  }
  return coupon;
}

function eligible(coupon: CouponDoc, line: PricedLine): boolean {
  const membership = line.product.kind === 'membership';
  switch (coupon.appliesTo) {
    case 'all':
      return true;
    case 'membership':
      return membership;
    case 'selected':
      return !membership && coupon.productIds.some((id) => id.equals(line.product._id));
    default:
      return !membership;
  }
}

export interface AppliedCoupon {
  coupon: CouponDoc;
  discountPaise: number;
  discountDisplayMinor: number;
  /** Discount per line (same order as the lines), in paise. */
  perLine: number[];
}

/**
 * Applies a coupon to priced lines (after combo and international pricing). Percent coupons take
 * that share off each eligible book; fixed coupons are spread over eligible books in proportion
 * to their price. A book never drops below ₹1. Displayed prices (USD abroad) shrink in step.
 */
export function applyCoupon(coupon: CouponDoc, lines: PricedLine[]): { lines: PricedLine[]; applied: AppliedCoupon } {
  const idx = lines.map((l, i) => (eligible(coupon, l) ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) throw new CouponError('This coupon does not apply to these items');
  const subtotal = idx.reduce((s, i) => s + lines[i]!.pricePaise, 0);
  if (subtotal < (coupon.minOrderPaise ?? 0)) {
    throw new CouponError(`This coupon needs an order of at least ₹${Math.ceil((coupon.minOrderPaise ?? 0) / 100)}`);
  }

  const room = (i: number) => Math.max(0, lines[i]!.pricePaise - MIN_LINE_PAISE);
  const perLine = lines.map(() => 0);
  if (coupon.type === 'percent') {
    for (const i of idx) perLine[i] = Math.min(room(i), Math.floor((lines[i]!.pricePaise * (coupon.percentOff ?? 0)) / 100));
  } else {
    const total = Math.min(coupon.amountOffPaise ?? 0, idx.reduce((s, i) => s + room(i), 0));
    let given = 0;
    for (const i of idx) {
      perLine[i] = Math.min(room(i), Math.floor((total * lines[i]!.pricePaise) / subtotal));
      given += perLine[i]!;
    }
    // Rounding leftovers go to the books with room left, largest first.
    for (const i of [...idx].sort((a, b) => lines[b]!.pricePaise - lines[a]!.pricePaise)) {
      const extra = Math.min(total - given, room(i) - perLine[i]!);
      if (extra > 0) {
        perLine[i]! += extra;
        given += extra;
      }
    }
  }
  if (perLine.every((d) => d === 0)) throw new CouponError('This coupon does not lower the price of these items');

  const next = lines.map((l, i) => {
    const d = perLine[i]!;
    if (!d) return l;
    const pricePaise = l.pricePaise - d;
    const displayPriceMinor = Math.round((l.displayPriceMinor * pricePaise) / l.pricePaise);
    return { ...l, pricePaise, displayPriceMinor, couponDiscountPaise: d, couponDisplayMinor: l.displayPriceMinor - displayPriceMinor };
  });
  const discountPaise = perLine.reduce((s, d) => s + d, 0);
  const discountDisplayMinor = lines.reduce((s, l, i) => s + (l.displayPriceMinor - next[i]!.displayPriceMinor), 0);
  return { lines: next, applied: { coupon, discountPaise, discountDisplayMinor, perLine } };
}
