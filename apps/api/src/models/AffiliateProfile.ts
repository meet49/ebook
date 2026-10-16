import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { AFFILIATE_STATUSES } from '@ebook/shared';

const affiliateProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** Short public code identifying the affiliate (not a secret). */
    code: { type: String, required: true, uppercase: true, trim: true },
    status: { type: String, enum: AFFILIATE_STATUSES, default: 'pending' },
    application: {
      website: String,
      channels: [String],
      audienceSize: String,
      promotionPlan: { type: String, maxlength: 2000 },
      submittedAt: { type: Date, default: Date.now },
    },
    payoutDetails: {
      method: { type: String, enum: ['upi', 'bank_transfer'] },
      upiId: String,
      accountName: String,
      /** AES-256-GCM encrypted; decrypted only when an admin processes a payout. */
      accountNumberEnc: { type: String, select: false },
      accountNumberLast4: String,
      ifsc: String,
      updatedAt: Date,
    },
    review: {
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      at: Date,
      note: String,
    },
  },
  { timestamps: true },
);

affiliateProfileSchema.index({ userId: 1 }, { unique: true });
affiliateProfileSchema.index({ code: 1 }, { unique: true });
affiliateProfileSchema.index({ status: 1, createdAt: -1 });

export type AffiliateProfileDoc = HydratedDocument<InferSchemaType<typeof affiliateProfileSchema>>;
export const AffiliateProfile = model('AffiliateProfile', affiliateProfileSchema);
