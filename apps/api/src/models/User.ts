import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ROLES, USER_STATUSES, type PublicUser } from '@ebook/shared';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    /** Absent for passwordless accounts created during guest checkout. */
    passwordHash: { type: String, select: false },
    roles: { type: [{ type: String, enum: ROLES }], default: ['customer'] },
    status: { type: String, enum: USER_STATUSES, default: 'active' },
    emailVerifiedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    /** Last affiliate click seen for this user, so attribution survives device switches after sign-in. */
    referral: {
      clickId: { type: Schema.Types.ObjectId, ref: 'AffiliateClick' },
      at: Date,
    },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ roles: 1, createdAt: -1 });

export type UserAttrs = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserAttrs>;
export const User = model('User', userSchema);

export function toPublicUser(user: UserDoc, hasPassword: boolean): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    roles: user.roles,
    status: user.status,
    emailVerified: Boolean(user.emailVerifiedAt),
    hasPassword,
    createdAt: user.createdAt.toISOString(),
  };
}
