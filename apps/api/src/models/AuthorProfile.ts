import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { AUTHOR_STATUSES, DEFAULT_AUTHOR_SHARE_PERCENT } from '@ebook/shared';

/** A marketplace author who publishes their own eBooks (each one reviewed by an admin). */
const authorProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: AUTHOR_STATUSES, default: 'pending' },
    penName: { type: String, required: true, trim: true, maxlength: 80 },
    bio: { type: String, default: '', maxlength: 1_000 },
    website: { type: String, default: '' },
    aboutBooks: { type: String, default: '', maxlength: 2_000 },
    /** Share of each sale after any affiliate commission, in percent. Set by the admin. */
    sharePercent: { type: Number, default: DEFAULT_AUTHOR_SHARE_PERCENT, min: 0, max: 100 },
    payoutDetails: {
      method: { type: String, enum: ['upi', 'bank_transfer'] },
      upiId: String,
      accountName: String,
      /** AES-256-GCM encrypted; decrypted only when an admin records a payout. */
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

authorProfileSchema.index({ userId: 1 }, { unique: true });
authorProfileSchema.index({ status: 1, createdAt: -1 });

export type AuthorProfileDoc = HydratedDocument<InferSchemaType<typeof authorProfileSchema>>;
export const AuthorProfile = model('AuthorProfile', authorProfileSchema);
