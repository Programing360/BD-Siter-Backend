import { Schema, model, Document, Types } from "mongoose";

export interface IResourceLibrary extends Document {
  title: string;
  slug: string;
  type: "Article" | "Video" | "Downloadable" | "Audio";
  category: string;
  description: string;
  content?: string;
  fileUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  tags: string[];
  accessLevel: "Public" | "Member" | "PaidMember" | "Admin";
  authorId?: Types.ObjectId;
  downloadCount: number;
  viewCount: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ResourceLibrarySchema = new Schema<IResourceLibrary>(
  {
    title: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    type: {
      type: String,
      enum: ["Article", "Video", "Downloadable", "Audio"],
      required: true,
    },
    category: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    content: { type: String },
    fileUrl: { type: String },
    videoUrl: { type: String },
    thumbnailUrl: { type: String },
    tags: [{ type: String, trim: true }],
    accessLevel: {
      type: String,
      enum: ["Public", "Member", "PaidMember", "Admin"],
      default: "Member",
    },
    authorId: { type: Schema.Types.ObjectId, ref: "User" },
    downloadCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ResourceLibrarySchema.index({ type: 1, category: 1 });
ResourceLibrarySchema.index({ accessLevel: 1, isPublished: 1 });
ResourceLibrarySchema.index({ tags: 1 });

export const ResourceLibrary = model<IResourceLibrary>(
  "ResourceLibrary",
  ResourceLibrarySchema
);
