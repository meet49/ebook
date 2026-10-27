import type { Request, Response } from 'express';
import type { FeaturedOffer } from '@ebook/shared';
import { Coupon } from '../../models/Coupon';
import { CouponError, loadUsableCoupon } from './coupons';

/** GET /coupons/featured — the coupon advertised on the home page, or null when none can be used now. */
export async function handleFeaturedOffer(_req: Request, res: Response): Promise<void> {
  const featured = await Coupon.findOne({ showOnHome: true, active: true, affiliateId: null });
  let offer: FeaturedOffer | null = null;
  if (featured) {
    try {
      const c = await loadUsableCoupon(featured.code, null);
      offer = {
        code: c.code,
        type: c.type,
        percentOff: c.percentOff ?? null,
        amountOffPaise: c.amountOffPaise ?? null,
        appliesTo: c.appliesTo,
        minOrderPaise: c.minOrderPaise ?? 0,
        endsAt: c.endsAt?.toISOString() ?? null,
      };
    } catch (err) {
      // Not started, expired or used up: nothing to advertise.
      if (!(err instanceof CouponError)) throw err;
    }
  }
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.json({ offer });
}
