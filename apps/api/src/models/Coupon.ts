import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { COUPON_SCOPES, COUPON_TYPES } from '@ebook/shared';

/** A discount code. Uses are counted from paid orders, so abandoned checkouts never use one up. */
const couponSchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: COUPON_TYPES, required: true },
    percentOff: { type: Number, default: null },
    amountOffPaise: { type: Number, default: null },
    appliesTo: { type: String, enum: COUPON_SCOPES, default: 'books' },
    productIds: { type: [Schema.Types.ObjectId], ref: 'Product', default: [] },
    minOrderPaise: { type: Number, default: 0 },
    /** Null means no limit. The admin form defaults the per-buyer limit to 1. */
    maxRedemptions: { type: Number, default: null },
    perUserLimit: { type: Number, default: null },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    /** Sales with this coupon are credited to this affiliate. */
    affiliateId: { type: Schema.Types.ObjectId, ref: 'AffiliateProfile', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ affiliateId: 1 });

export type CouponDoc = HydratedDocument<InferSchemaType<typeof couponSchema>>;
export const Coupon = model('Coupon', couponSchema);
