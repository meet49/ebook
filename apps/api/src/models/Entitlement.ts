import { Schema, model, type InferSchemaType } from 'mongoose';
import { ENTITLEMENT_STATUSES } from '@ebook/shared';

/** Grants a user reading access to a product. Created only after verified payment. */
const entitlementSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    status: { type: String, enum: ENTITLEMENT_STATUSES, default: 'active' },
    grantedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
    revokeReason: String,
  },
  { timestamps: true },
);

entitlementSchema.index({ userId: 1, productId: 1 }, { unique: true });
entitlementSchema.index({ productId: 1, status: 1 });

export type EntitlementAttrs = InferSchemaType<typeof entitlementSchema>;
export const Entitlement = model('Entitlement', entitlementSchema);
