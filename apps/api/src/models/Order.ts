import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ATTRIBUTION_TYPES, ORDER_STATUSES } from '@ebook/shared';

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** The main book (the first line). Kept for orders made before combos and for simple lookups. */
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    /** Snapshot at order time so later product edits do not rewrite history. */
    productSnapshot: { title: String, slug: String },
    /**
     * Every book in the order with what was charged for it. Orders made before combos have no
     * lines; use orderLines() to read any order uniformly.
     */
    items: {
      type: [
        {
          _id: false,
          productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
          title: String,
          slug: String,
          listPricePaise: { type: Number, required: true },
          pricePaise: { type: Number, required: true },
          combo: { type: Boolean, default: false },
          /** What the buyer was shown for this book, in the display currency's minor unit. */
          displayPriceMinor: { type: Number, default: null },
          /** This book's commission rule at order time; null when it pays no commission. */
          commissionRule: {
            type: new Schema({ type: { type: String, enum: ['percent', 'fixed'] }, value: Number }, { _id: false }),
            default: null,
          },
        },
      ],
      default: [],
    },
    customerSnapshot: { name: String, email: String },

    amountPaise: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    /** Prices as shown to the buyer. International orders show USD but are always charged in INR. */
    display: {
      currency: { type: String, enum: ['INR', 'USD'], default: 'INR' },
      totalMinor: { type: Number, default: null },
      /** INR per USD used for the conversion. */
      fxRate: { type: Number, default: null },
    },
    status: { type: String, enum: ORDER_STATUSES, default: 'created' },

    razorpay: {
      orderId: { type: String, required: true },
      paymentId: { type: String, default: null },
      method: String,
    },

    attribution: {
      type: { type: String, enum: ATTRIBUTION_TYPES, default: 'direct' },
      affiliateId: { type: Schema.Types.ObjectId, ref: 'AffiliateProfile', default: null },
      affiliateProductId: { type: Schema.Types.ObjectId, ref: 'AffiliateProduct', default: null },
      clickId: { type: Schema.Types.ObjectId, ref: 'AffiliateClick', default: null },
      clickedAt: { type: Date, default: null },
      /** Product commission rule snapshotted when the order was created. */
      rule: {
        type: { type: String, enum: ['percent', 'fixed'] },
        value: Number,
      },
    },

    refunds: {
      type: [
        {
          _id: false,
          refundId: String,
          amountPaise: Number,
          status: String,
          createdAt: Date,
        },
      ],
      default: [],
    },
    refundedPaise: { type: Number, default: 0 },

    paidAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    failureReason: String,
    fulfilledAt: { type: Date, default: null },
    purchaseEmailSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ 'razorpay.orderId': 1 }, { unique: true });
orderSchema.index(
  { 'razorpay.paymentId': 1 },
  { unique: true, partialFilterExpression: { 'razorpay.paymentId': { $type: 'string' } } },
);
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ 'items.productId': 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'attribution.affiliateId': 1, createdAt: -1 });

export type OrderAttrs = InferSchemaType<typeof orderSchema>;
export type OrderDoc = HydratedDocument<OrderAttrs>;
export const Order = model('Order', orderSchema);
