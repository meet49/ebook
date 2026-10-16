import { Schema, model, type InferSchemaType } from 'mongoose';

/** Append-only log of security-relevant and administrative actions. */
const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true },
    entity: {
      type: { type: String },
      id: { type: Schema.Types.ObjectId, default: null },
    },
    meta: Schema.Types.Mixed,
    ip: String,
    userAgent: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ 'entity.type': 1, 'entity.id': 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });

export type AuditLogAttrs = InferSchemaType<typeof auditLogSchema>;
export const AuditLog = model('AuditLog', auditLogSchema);
