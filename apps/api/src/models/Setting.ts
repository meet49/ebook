import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * Admin-editable configuration (key/value). Secrets inside `value` are stored encrypted
 * with encryptField and are never returned to clients.
 */
const settingSchema = new Schema(
  {
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

settingSchema.index({ key: 1 }, { unique: true });

export type SettingAttrs = InferSchemaType<typeof settingSchema>;
export const Setting = model('Setting', settingSchema);

export const SETTING_KEYS = {
  razorpay: 'payments.razorpay',
  analytics: 'analytics.google',
  metaPixel: 'analytics.meta_pixel',
  fxUsdInr: 'fx.usd_inr',
} as const;
