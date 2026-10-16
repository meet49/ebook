import { Schema, model, type InferSchemaType } from 'mongoose';

const readingProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    page: { type: Number, default: 1, min: 1 },
    totalPages: { type: Number, default: 0 },
    percent: { type: Number, default: 0, min: 0, max: 100 },
    lastOpenedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

readingProgressSchema.index({ userId: 1, productId: 1 }, { unique: true });
readingProgressSchema.index({ userId: 1, lastOpenedAt: -1 });

export type ReadingProgressAttrs = InferSchemaType<typeof readingProgressSchema>;
export const ReadingProgress = model('ReadingProgress', readingProgressSchema);
