import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { COMMISSION_STATUSES, COMMISSION_TYPES } from '@ebook/shared';

/** Auditable commission ledger entry. At most one per order (unique orderId). */
const commissionSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    affiliateId: { type: Schema.Types.ObjectId, ref: 'AffiliateProfile', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    /** The commissionable amount: what was actually captured for the order. */
    baseAmountPaise: { type: Number, required: true },
    /** Snapshot of the product rule at purchase time. */
    rule: {
      type: { type: String, enum: COMMISSION_TYPES, required: true },
      value: { type: Number, required: true },
    },
    amountPaise: { type: Number, required: true },
    status: { type: String, enum: COMMISSION_STATUSES, default: 'pending' },
    holdUntil: { type: Date, required: true },
    payoutId: { type: Schema.Types.ObjectId, ref: 'Payout', default: null },
    /** Set when a refund arrives after the commission was already paid out. */
    clawbackRequired: { type: Boolean, default: false },
    history: {
      type: [
        {
          _id: false,
          status: { type: String, enum: COMMISSION_STATUSES },
          at: { type: Date, default: Date.now },
          by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
          note: String,
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

commissionSchema.index({ orderId: 1 }, { unique: true });
commissionSchema.index({ affiliateId: 1, status: 1, createdAt: -1 });
commissionSchema.index({ status: 1, holdUntil: 1 });

export type CommissionAttrs = InferSchemaType<typeof commissionSchema>;
export type CommissionDoc = HydratedDocument<CommissionAttrs>;
export const Commission = model('Commission', commissionSchema);
