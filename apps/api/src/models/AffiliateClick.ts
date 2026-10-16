import { Schema, model, type InferSchemaType } from 'mongoose';

const affiliateClickSchema = new Schema(
  {
    affiliateId: { type: Schema.Types.ObjectId, ref: 'AffiliateProfile', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    affiliateProductId: { type: Schema.Types.ObjectId, ref: 'AffiliateProduct', required: true },
    /** Anonymous first-party visitor id cookie, for de-duplicating click stats. */
    visitorId: String,
    ipHash: String,
    userAgent: String,
    referrer: String,
    convertedOrderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

affiliateClickSchema.index({ affiliateId: 1, createdAt: -1 });
affiliateClickSchema.index({ affiliateProductId: 1, createdAt: -1 });

export type AffiliateClickAttrs = InferSchemaType<typeof affiliateClickSchema>;
export const AffiliateClick = model('AffiliateClick', affiliateClickSchema);
