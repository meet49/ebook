import { Schema, model, type InferSchemaType } from 'mongoose';

/** One referral link per affiliate per product. */
const affiliateProductSchema = new Schema(
  {
    affiliateId: { type: Schema.Types.ObjectId, ref: 'AffiliateProfile', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    linkCode: { type: String, required: true },
    clicks: { type: Number, default: 0 },
    lastClickAt: { type: Date, default: null },
  },
  { timestamps: true },
);

affiliateProductSchema.index({ affiliateId: 1, productId: 1 }, { unique: true });
affiliateProductSchema.index({ linkCode: 1 }, { unique: true });

export type AffiliateProductAttrs = InferSchemaType<typeof affiliateProductSchema>;
export const AffiliateProduct = model('AffiliateProduct', affiliateProductSchema);
