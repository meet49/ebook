import { Schema, model, type InferSchemaType } from 'mongoose';

const bookmarkSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    page: { type: Number, required: true, min: 1 },
    label: { type: String, maxlength: 120 },
  },
  { timestamps: true },
);

bookmarkSchema.index({ userId: 1, productId: 1, page: 1 }, { unique: true });

export type BookmarkAttrs = InferSchemaType<typeof bookmarkSchema>;
export const Bookmark = model('Bookmark', bookmarkSchema);
