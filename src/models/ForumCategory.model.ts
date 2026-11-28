import { Schema, model, Document, Types } from "mongoose";

export interface IForumCategory extends Document {
  name: string;
  slug: string;
  description: string;
  wingName?: string;
  order: number;
  isActive: boolean;
  icon?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ForumCategorySchema = new Schema<IForumCategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    wingName: {
      type: String,
      trim: true,
      default: "General",
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    icon: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

ForumCategorySchema.index({ isActive: 1, order: 1 });

export const ForumCategory = model<IForumCategory>(
  "ForumCategory",
  ForumCategorySchema
);
