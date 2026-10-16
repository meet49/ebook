import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** SHA-256 of the cookie value. The raw token is never stored. */
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    lastSeenAt: { type: Date, default: Date.now },
    ip: String,
    userAgent: String,
  },
  { timestamps: true },
);

sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ userId: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDoc = HydratedDocument<InferSchemaType<typeof sessionSchema>>;
export const Session = model('Session', sessionSchema);
