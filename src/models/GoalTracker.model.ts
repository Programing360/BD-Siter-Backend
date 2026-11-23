import { Schema, model, Document, Types } from "mongoose";

export interface IMilestone {
  title: string;
  isCompleted: boolean;
  completedAt?: Date;
}

export interface IGoalTracker extends Document {
  userId: Types.ObjectId;
  title: string;
  category: "Spiritual" | "Career" | "Health" | "Family" | "Skill" | "Other";
  targetDate?: Date;
  progress: number; // 0 - 100
  status: "NotStarted" | "InProgress" | "Completed" | "OnHold";
  milestones: IMilestone[];
  notes?: string;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MilestoneSchema = new Schema<IMilestone>(
  {
    title: { type: String, required: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
  },
  { _id: true }
);

const GoalTrackerSchema = new Schema<IGoalTracker>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    category: {
      type: String,
      enum: ["Spiritual", "Career", "Health", "Family", "Skill", "Other"],
      default: "Other",
    },
    targetDate: { type: Date },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    status: {
      type: String,
      enum: ["NotStarted", "InProgress", "Completed", "OnHold"],
      default: "NotStarted",
    },
    milestones: [MilestoneSchema],
    notes: { type: String },
    isPrivate: { type: Boolean, default: true },
  },
  { timestamps: true }
);

GoalTrackerSchema.index({ userId: 1 });
GoalTrackerSchema.index({ status: 1 });

export const GoalTracker = model<IGoalTracker>("GoalTracker", GoalTrackerSchema);
