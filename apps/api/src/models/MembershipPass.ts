import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * One paid membership pass (a plan bought in an order). Passes stack: a pass bought while
 * another is running starts when that one ends. A full refund revokes the pass.
 */
const membershipPassSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    days: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    grantedAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

membershipPassSchema.index({ orderId: 1, productId: 1 }, { unique: true });
membershipPassSchema.index({ userId: 1, status: 1, grantedAt: 1 });

export type MembershipPassDoc = HydratedDocument<InferSchemaType<typeof membershipPassSchema>>;
export const MembershipPass = model('MembershipPass', membershipPassSchema);
