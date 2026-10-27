import { Router, type Request } from 'express';
import { Types } from 'mongoose';
import { couponInputSchema, type AdminCoupon, type CouponInputParsed } from '@ebook/shared';
import { audit } from '../../lib/audit';
import { HttpError, badRequest, notFound } from '../../lib/errors';
import { parse } from '../../middleware/validate';
import { AffiliateProfile } from '../../models/AffiliateProfile';
import { Coupon, type CouponDoc } from '../../models/Coupon';
import { Order } from '../../models/Order';

export const adminCouponsRouter = Router();

const USED: ('paid' | 'partially_refunded')[] = ['paid', 'partially_refunded'];

async function toDtos(coupons: CouponDoc[]): Promise<AdminCoupon[]> {
  const ids = coupons.map((c) => c._id);
  const [usage, affiliates] = await Promise.all([
    Order.aggregate<{ _id: Types.ObjectId; uses: number; discount: number }>([
      { $match: { 'coupon.couponId': { $in: ids }, status: { $in: USED } } },
      { $group: { _id: '$coupon.couponId', uses: { $sum: 1 }, discount: { $sum: '$coupon.discountPaise' } } },
    ]),
    AffiliateProfile.find({ _id: { $in: coupons.flatMap((c) => (c.affiliateId ? [c.affiliateId] : [])) } }).select('code'),
  ]);
  const usageBy = new Map(usage.map((u) => [u._id.toString(), u]));
  const codeBy = new Map(affiliates.map((a) => [a._id.toString(), a.code]));
  return coupons.map((c) => ({
    id: c._id.toString(),
    code: c.code,
    description: c.description ?? '',
    type: c.type,
    percentOff: c.percentOff ?? null,
    amountOffPaise: c.amountOffPaise ?? null,
    appliesTo: c.appliesTo,
    productIds: c.productIds.map(String),
    minOrderPaise: c.minOrderPaise ?? 0,
    maxRedemptions: c.maxRedemptions ?? null,
    perUserLimit: c.perUserLimit ?? null,
    startsAt: c.startsAt?.toISOString() ?? null,
    endsAt: c.endsAt?.toISOString() ?? null,
    active: c.active,
    affiliateCode: c.affiliateId ? (codeBy.get(c.affiliateId.toString()) ?? null) : null,
    uses: usageBy.get(c._id.toString())?.uses ?? 0,
    discountPaise: usageBy.get(c._id.toString())?.discount ?? 0,
    createdAt: c.createdAt.toISOString(),
  }));
}

async function values(input: CouponInputParsed) {
  let affiliateId: Types.ObjectId | null = null;
  if (input.affiliateCode) {
    const affiliate = await AffiliateProfile.findOne({ code: input.affiliateCode });
    if (!affiliate) throw badRequest('No affiliate has this code', { affiliateCode: ['No affiliate has this code'] });
    affiliateId = affiliate._id;
  }
  return {
    code: input.code,
    description: input.description,
    type: input.type,
    percentOff: input.type === 'percent' ? input.percentOff : null,
    amountOffPaise: input.type === 'fixed' ? input.amountOffPaise : null,
    appliesTo: input.appliesTo,
    productIds: input.appliesTo === 'selected' ? input.productIds.map((id) => new Types.ObjectId(id)) : [],
    minOrderPaise: input.minOrderPaise,
    maxRedemptions: input.maxRedemptions,
    perUserLimit: input.perUserLimit,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    active: input.active,
    affiliateId,
  };
}

const duplicate = () => new HttpError(409, 'CONFLICT', 'A coupon with this code already exists', { code: ['A coupon with this code already exists'] });

async function loadCoupon(req: Request): Promise<CouponDoc> {
  const id = String(req.params.id);
  const coupon = Types.ObjectId.isValid(id) ? await Coupon.findById(id) : null;
  if (!coupon) throw notFound('Coupon not found');
  return coupon;
}

adminCouponsRouter.get('/', async (_req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 }).limit(500);
  res.json({ items: await toDtos(coupons) });
});

adminCouponsRouter.post('/', async (req, res) => {
  const input = parse(couponInputSchema, req.body);
  if (await Coupon.exists({ code: input.code })) throw duplicate();
  const coupon = await Coupon.create({ ...(await values(input)), createdBy: req.auth!.user._id });
  await audit({ action: 'coupon.created', entityType: 'Coupon', entityId: coupon._id, meta: { code: coupon.code }, req });
  res.status(201).json({ coupon: (await toDtos([coupon]))[0] });
});

adminCouponsRouter.put('/:id', async (req, res) => {
  const coupon = await loadCoupon(req);
  const input = parse(couponInputSchema, req.body);
  if (input.code !== coupon.code && (await Coupon.exists({ code: input.code }))) throw duplicate();
  coupon.set(await values(input));
  await coupon.save();
  await audit({ action: 'coupon.updated', entityType: 'Coupon', entityId: coupon._id, meta: { code: coupon.code, active: coupon.active }, req });
  res.json({ coupon: (await toDtos([coupon]))[0] });
});

/** Deletes an unused coupon. A used one is kept for order history; turn it off instead. */
adminCouponsRouter.delete('/:id', async (req, res) => {
  const coupon = await loadCoupon(req);
  if (await Order.exists({ 'coupon.couponId': coupon._id, status: { $ne: 'created' } })) {
    throw new HttpError(409, 'COUPON_USED', 'This coupon has been used, so it is kept for order history. Turn it off instead.');
  }
  await Coupon.deleteOne({ _id: coupon._id });
  await audit({ action: 'coupon.deleted', entityType: 'Coupon', entityId: coupon._id, meta: { code: coupon.code }, req });
  res.json({ ok: true });
});
