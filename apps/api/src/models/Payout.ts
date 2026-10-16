import { Schema, model, type InferSchemaType } from 'mongoose';
import { PAYOUT_STATUSES } from '@ebook/shared';

/**
 * Affiliate payout request. The admin transfers money manually outside the platform and
 * records the real transaction reference; status becomes "paid" only at that point.
 */
const payoutSchema = new Schema(
  {
    affiliateId: { type: Schema.Types.ObjectId, ref: 'AffiliateProfile', required: true },
    amountPaise: { type: Number, required: true },
    commissionIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Commission' }], default: [] },
    status: { type: String, enum: PAYOUT_STATUSES, default: 'requested' },
    method: { type: String, enum: ['upi', 'bank_transfer'] },
    /** Human-readable, masked destination snapshot at request time. */
    destination: String,
    /** Full destination frozen at request time (AES-256-GCM JSON), so later profile edits cannot redirect it. */
    destinationEnc: { type: String, select: false },
    /** True while requested/processing; enforces one open payout per affiliate. */
    open: { type: Boolean, default: true },
    reference: { type: String, default: null },
    paidAt: { type: Date, default: null },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    adminNote: String,
    affiliateNote: String,
  },
  { timestamps: true },
);

payoutSchema.index({ affiliateId: 1, createdAt: -1 });
payoutSchema.index({ status: 1, createdAt: -1 });
payoutSchema.index({ affiliateId: 1 }, { unique: true, partialFilterExpression: { open: true }, name: 'one_open_payout_per_affiliate' });

export type PayoutAttrs = InferSchemaType<typeof payoutSchema>;
export const Payout = model('Payout', payoutSchema);
