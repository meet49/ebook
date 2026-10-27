import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/** A payment the admin made to an author (outside the app), settling their payable earnings. */
const authorPayoutSchema = new Schema(
  {
    authorProfileId: { type: Schema.Types.ObjectId, ref: 'AuthorProfile', required: true },
    amountPaise: { type: Number, required: true },
    earningIds: { type: [Schema.Types.ObjectId], ref: 'AuthorEarning', default: [] },
    /** Bank UTR / UPI reference of the transfer. */
    reference: { type: String, required: true },
    note: { type: String, default: '' },
    /** Where it was sent, e.g. "UPI name@bank" or "Bank ••1234". */
    destination: { type: String, default: '' },
    paidBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

authorPayoutSchema.index({ authorProfileId: 1, createdAt: -1 });

export type AuthorPayoutDoc = HydratedDocument<InferSchemaType<typeof authorPayoutSchema>>;
export const AuthorPayout = model('AuthorPayout', authorPayoutSchema);
