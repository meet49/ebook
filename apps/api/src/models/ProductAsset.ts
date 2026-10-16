import { Schema, model, type InferSchemaType } from 'mongoose';
import { ASSET_KINDS } from '@ebook/shared';

/** Files in private object storage. storageKey is never sent to browsers. */
const productAssetSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    kind: { type: String, enum: ASSET_KINDS, required: true },
    storageKey: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    /** 1-based page number for page_image assets. */
    page: { type: Number, default: null },
    /** For page_image assets: the original_pdf asset they were rendered from (the "page set"). */
    sourceAssetId: { type: Schema.Types.ObjectId, ref: 'ProductAsset', default: null },
    width: Number,
    height: Number,
    checksumSha256: String,
    originalFilename: String,
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

productAssetSchema.index({ productId: 1, kind: 1, page: 1 });
productAssetSchema.index({ sourceAssetId: 1, page: 1 });
productAssetSchema.index({ storageKey: 1 }, { unique: true });

export type ProductAssetAttrs = InferSchemaType<typeof productAssetSchema>;
export const ProductAsset = model('ProductAsset', productAssetSchema);
