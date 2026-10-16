import { Schema, model, type InferSchemaType } from 'mongoose';

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: String,
    link: String,
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, createdAt: -1 });

export type NotificationAttrs = InferSchemaType<typeof notificationSchema>;
export const Notification = model('Notification', notificationSchema);
