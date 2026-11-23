import { Schema, model, Document, Types } from "mongoose";

export interface IAuditLog extends Document {
  adminId: Types.ObjectId;
  action: string;
  targetModel: string;
  targetId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    targetModel: { type: String, required: true },
    targetId: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

AuditLogSchema.index({ adminId: 1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ targetModel: 1 });
AuditLogSchema.index({ targetId: 1 });
AuditLogSchema.index({ createdAt: -1 });

export const AuditLog = model<IAuditLog>("AuditLog", AuditLogSchema);

// Helper function to log admin operations consistently
export const logAdminAction = async ({
  adminId,
  action,
  targetModel,
  targetId,
  details,
  ipAddress,
}: {
  adminId: Types.ObjectId | string;
  action: string;
  targetModel: string;
  targetId: Types.ObjectId | string;
  details?: Record<string, any>;
  ipAddress?: string;
}): Promise<IAuditLog> => {
  return await AuditLog.create({
    adminId,
    action,
    targetModel,
    targetId: targetId.toString(),
    details,
    ipAddress,
  });
};
