import { Schema, model, Document, Types } from "mongoose";

export const WING_NAMES = [
  "FaithAndGrowth",
  "FamilyAndParenting",
  "SistersInBusiness",
  "HealthAndWellness",
  "SkillsExchange",
  "ProjectTasks",
  "General",
] as const;

export type WingNameType = (typeof WING_NAMES)[number];

export interface IPostComment {
  _id?: Types.ObjectId;
  commenterId: Types.ObjectId;
  comment: string;
  createdAt: Date;
}

export interface IPostReport {
  reporterId: Types.ObjectId;
  reason: string;
  createdAt: Date;
}

export interface IPost extends Document {
  authorId: Types.ObjectId;
  wingName: WingNameType;
  content: string;
  mediaUrls: string[];
  likes: Types.ObjectId[];
  comments: Types.DocumentArray<IPostComment & Types.Subdocument>;
  isDeleted: boolean;
  reportCount: number;
  reports: IPostReport[];
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    wingName: {
      type: String,
      enum: WING_NAMES,
      required: true,
      default: "General",
    },
    content: { type: String, required: true, maxlength: 2000 },
    mediaUrls: [{ type: String }],
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    comments: [
      {
        commenterId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        comment: { type: String, required: true, maxlength: 500 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isDeleted: { type: Boolean, default: false },
    reportCount: { type: Number, default: 0 },
    reports: [
      {
        reporterId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        reason: { type: String, required: true, maxlength: 300 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

PostSchema.index({ wingName: 1 });
PostSchema.index({ createdAt: -1 });
PostSchema.index({ isDeleted: 1 });

export const Post = model<IPost>("Post", PostSchema);
