import { Schema, model, type InferSchemaType } from 'mongoose';
import { PAYMENT_EVENT_STATUSES } from '@ebook/shared';

/** Every webhook delivery, stored once. The unique index makes redelivery a no-op. */
const paymentEventSchema = new Schema(
  {
    provider: { type: String, required: true, default: 'razorpay' },
    eventId: { type: String, required: true },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: PAYMENT_EVENT_STATUSES, default: 'received' },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    error: String,
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

paymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
paymentEventSchema.index({ status: 1, createdAt: -1 });

export type PaymentEventAttrs = InferSchemaType<typeof paymentEventSchema>;
export const PaymentEvent = model('PaymentEvent', paymentEventSchema);
