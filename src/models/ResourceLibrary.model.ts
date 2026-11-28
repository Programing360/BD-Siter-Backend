import { Schema, model, Document, Types } from "mongoose";

export interface IResourceLibrary extends Document {
  title: string;
  slug: string;
  type: "Article" | "Video" | "Downloadable" | "Audio" | "Worksheet" | "Curated";
  format?: "Downloadable" | "Video" | "Article" | "Audio" | "Worksheet" | "Curated";
  category: string;
  wing?: string; // "BDSisters", "TSPP", "CoP", "MIDJ", "The Hut Network"
  curatedBySister?: string;
  fileSizeOrDuration?: string; // e.g., "4.2 MB PDF", "45 mins"
  description: string;
  content?: string;
  fileUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  tags: string[];
  accessLevel: "Public" | "Member" | "PaidMember" | "Admin";
  authorId?: Types.ObjectId;
  downloadCount: number;
  downloadsCount: number;
  downloadsOrReads?: number;
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
      enum: ["Article", "Video", "Downloadable", "Audio", "Worksheet", "Curated"],
      required: true,
      default: "Downloadable",
    },
    format: {
      type: String,
      enum: ["Downloadable", "Video", "Article", "Audio", "Worksheet", "Curated"],
    },
    category: { type: String, required: true, trim: true, default: "General" },
    wing: { type: String, default: "BDSisters" },
    curatedBySister: { type: String },
    fileSizeOrDuration: { type: String },
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
    downloadsCount: { type: Number, default: 0 },
    downloadsOrReads: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ResourceLibrarySchema.pre("save", function () {
  if (this.format && !this.type) {
    this.type = this.format as any;
  } else if (this.type && !this.format) {
    this.format = this.type as any;
  }
  const maxVal = Math.max(
    Number(this.downloadCount) || 0,
    Number(this.downloadsCount) || 0,
    Number(this.downloadsOrReads) || 0
  );
  this.downloadCount = maxVal;
  this.downloadsCount = maxVal;
  this.downloadsOrReads = maxVal;
});

ResourceLibrarySchema.index({ type: 1, category: 1 });
ResourceLibrarySchema.index({ wing: 1 });
ResourceLibrarySchema.index({ accessLevel: 1, isPublished: 1 });
ResourceLibrarySchema.index({ tags: 1 });

export const ResourceLibrary = model<IResourceLibrary>(
  "ResourceLibrary",
  ResourceLibrarySchema
);
