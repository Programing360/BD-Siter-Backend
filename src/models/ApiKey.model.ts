import { Schema, model, Document, Types } from "mongoose";

export interface IApiKey extends Document {
  name: string; // e.g. "Muhsina Organization", "CoP", "TSPP", "IMBD", "MIDJ", "The Hut Network"
  keyHash: string; // SHA-256 hashed key
  prefix: string; // First 8 chars for identification in UI (e.g. bds_live...)
  permissions: string[]; // e.g. ["members:read", "wings:read", "events:read"]
  isActive: boolean;
  lastUsedAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    name: { type: String, required: true },
    keyHash: { type: String, required: true, unique: true },
    prefix: { type: String, required: true },
    permissions: [{ type: String }],
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

ApiKeySchema.index({ isActive: 1 });

export const ApiKey = model<IApiKey>("ApiKey", ApiKeySchema);
