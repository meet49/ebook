import { Schema, model, type InferSchemaType } from 'mongoose';
import { AUTH_TOKEN_PURPOSES } from '@ebook/shared';

/** Single-use, expiring tokens for email links (verification, password reset, magic login). */
const authTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, enum: AUTH_TOKEN_PURPOSES, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    /** Where to send the user after a successful magic login (relative path only). */
    redirectTo: String,
  },
  { timestamps: true },
);

authTokenSchema.index({ tokenHash: 1 }, { unique: true });
authTokenSchema.index({ userId: 1, purpose: 1 });
// Keep used/expired tokens for a day for debugging, then drop them.
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86_400 });

export type AuthTokenAttrs = InferSchemaType<typeof authTokenSchema>;
export const AuthToken = model('AuthToken', authTokenSchema);
