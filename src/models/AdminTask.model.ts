import { Schema, model, Document, Types } from "mongoose";

export interface IAdminTask extends Document {
  title: string;
  description: string;
  assignedTo: Types.ObjectId;
  assignedBy: Types.ObjectId;
  priority: "Low" | "Medium" | "High" | "Urgent";
  status: "Pending" | "InProgress" | "Completed" | "Cancelled";
  dueDate?: Date;
  notes?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AdminTaskSchema = new Schema<IAdminTask>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["Pending", "InProgress", "Completed", "Cancelled"],
      default: "Pending",
    },
    dueDate: { type: Date },
    notes: { type: String },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

AdminTaskSchema.index({ assignedTo: 1, status: 1 });
AdminTaskSchema.index({ assignedBy: 1 });
AdminTaskSchema.index({ priority: 1 });
AdminTaskSchema.index({ dueDate: 1 });

export const AdminTask = model<IAdminTask>("AdminTask", AdminTaskSchema);
