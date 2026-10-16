import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { COMMISSION_TYPES, PRODUCT_STATUSES } from '@ebook/shared';

const integerPaise = {
  validator: (v: number | null | undefined) => v == null || (Number.isSafeInteger(v) && v >= 0),
  message: 'Amount must be a non-negative integer number of paise',
};

const productSchema = new Schema(
  {
    slug: { type: String, required: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    subtitle: { type: String, trim: true, maxlength: 240 },
    author: { type: String, trim: true, maxlength: 120 },
    description: { type: String, maxlength: 20_000 },
    benefits: { type: [String], default: [] },
    categories: { type: [String], default: [] },
    language: { type: String, default: 'English' },

    pricePaise: { type: Number, required: true, validate: integerPaise },
    /** Optional discounted price; must be lower than pricePaise. Checkout charges this when set. */
    salePricePaise: { type: Number, default: null, validate: integerPaise },
    /** Derived from pricePaise/salePricePaise on every save; used for sorting and checkout. */
    effectivePricePaise: { type: Number, default: 0 },
    currency: { type: String, default: 'INR', enum: ['INR'] },

    status: { type: String, enum: PRODUCT_STATUSES, default: 'draft' },
    featured: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },

    affiliate: {
      enabled: { type: Boolean, default: true },
      type: { type: String, enum: COMMISSION_TYPES, default: 'percent' },
      /** Basis points when type=percent (2000 = 20%), paise when type=fixed. */
      value: { type: Number, default: 2000, validate: integerPaise },
    },

    pageCount: { type: Number, default: 0 },
    toc: { type: [{ title: String, page: Number, _id: false }], default: [] },
    /** 1-based page numbers viewable publicly as samples. */
    previewPages: { type: [Number], default: [] },
    coverAssetId: { type: Schema.Types.ObjectId, ref: 'ProductAsset', default: null },
    /** Latest uploaded original PDF (may still be processing). */
    pdfAssetId: { type: Schema.Types.ObjectId, ref: 'ProductAsset', default: null },
    /** Original PDF whose rendered pages are live. Only replaced after a new upload fully succeeds. */
    pageSetId: { type: Schema.Types.ObjectId, ref: 'ProductAsset', default: null },
    processing: {
      status: { type: String, enum: ['none', 'queued', 'processing', 'ready', 'failed'], default: 'none' },
      error: { type: String, default: null },
      done: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      /** Render attempts for the current upload; stops automatic retries looping on a bad file. */
      attempts: { type: Number, default: 0 },
      updatedAt: Date,
    },
  },
  { timestamps: true },
);

productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ status: 1, featured: -1, publishedAt: -1 });
productSchema.index({ categories: 1 });
productSchema.index({ status: 1, effectivePricePaise: 1 });

productSchema.pre('validate', function () {
  this.effectivePricePaise = effectivePricePaise(this);
  if (this.salePricePaise != null && this.salePricePaise >= this.pricePaise) {
    this.invalidate('salePricePaise', 'Sale price must be lower than the regular price');
  }
  if (this.affiliate?.type === 'percent' && (this.affiliate.value ?? 0) > 10_000) {
    this.invalidate('affiliate.value', 'Commission cannot exceed 100%');
  }
});

export type ProductAttrs = InferSchemaType<typeof productSchema>;
export type ProductDoc = HydratedDocument<ProductAttrs>;
export const Product = model('Product', productSchema);

/** The amount actually charged at checkout. Server-side source of truth. */
export function effectivePricePaise(p: Pick<ProductAttrs, 'pricePaise' | 'salePricePaise'>): number {
  return p.salePricePaise != null && p.salePricePaise < p.pricePaise ? p.salePricePaise : p.pricePaise;
}
