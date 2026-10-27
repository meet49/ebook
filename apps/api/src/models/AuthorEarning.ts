import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { AUTHOR_EARNING_STATUSES } from '@ebook/shared';

/**
 * An author's earnings from one paid order: their share of each of their books in it, after any
 * affiliate commission on that book. One entry per order and author.
 */
const authorEarningSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    orderNumber: { type: String, required: true },
    authorProfileId: { type: Schema.Types.ObjectId, ref: 'AuthorProfile', required: true },
    lines: {
      type: [
        {
          _id: false,
          productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
          title: String,
          pricePaise: { type: Number, required: true },
          commissionPaise: { type: Number, default: 0 },
          sharePercent: { type: Number, required: true },
          amountPaise: { type: Number, required: true },
        },
      ],
      default: [],
    },
    /** Before any refund; amountPaise shrinks in proportion to partial refunds. */
    originalAmountPaise: { type: Number, required: true },
    amountPaise: { type: Number, required: true },
    status: { type: String, enum: AUTHOR_EARNING_STATUSES, default: 'pending' },
    holdUntil: { type: Date, required: true },
    payoutId: { type: Schema.Types.ObjectId, ref: 'AuthorPayout', default: null },
    /** Set when a refund arrives after the earning was already paid out. */
    clawbackRequired: { type: Boolean, default: false },
    history: {
      type: [{ _id: false, status: String, at: { type: Date, default: Date.now }, note: String }],
      default: [],
    },
  },
  { timestamps: true },
);

authorEarningSchema.index({ orderId: 1, authorProfileId: 1 }, { unique: true });
authorEarningSchema.index({ authorProfileId: 1, status: 1, createdAt: -1 });
authorEarningSchema.index({ status: 1, holdUntil: 1 });

export type AuthorEarningDoc = HydratedDocument<InferSchemaType<typeof authorEarningSchema>>;
export const AuthorEarning = model('AuthorEarning', authorEarningSchema);
