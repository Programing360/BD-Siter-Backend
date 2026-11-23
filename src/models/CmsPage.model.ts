import { Schema, model, Document, Types } from "mongoose";

export interface IContentBlock {
  blockId: string; // unique identifier key e.g. "hero-section", "values-grid"
  title: string;
  subtitle?: string;
  content: string; // Markdown or rich text
  order: number;
  isVisible: boolean;
  imageUrl?: string;
  hoverTooltip: string; // Hover tooltip explanation for this section
  ctaText?: string;
  ctaLink?: string;
  metadata?: Record<string, any>;
}

export interface ICmsPage extends Document {
  slug: string; // e.g. "home", "about-us", "wings", "rules-ethics"
  title: string;
  metaDescription?: string;
  isPublished: boolean;
  showInNav: boolean;
  navLabel?: string;
  navOrder: number;
  blocks: IContentBlock[];
  lastEditedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ContentBlockSchema = new Schema<IContentBlock>(
  {
    blockId: { type: String, required: true },
    title: { type: String, required: true },
    subtitle: { type: String },
    content: { type: String, default: "" },
    order: { type: Number, default: 0 },
    isVisible: { type: Boolean, default: true },
    imageUrl: { type: String },
    hoverTooltip: {
      type: String,
      default: "",
    },
    ctaText: { type: String },
    ctaLink: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: true }
);

const CmsPageSchema = new Schema<ICmsPage>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    title: { type: String, required: true },
    metaDescription: { type: String },
    isPublished: { type: Boolean, default: false },
    showInNav: { type: Boolean, default: false },
    navLabel: { type: String },
    navOrder: { type: Number, default: 0 },
    blocks: [ContentBlockSchema],
    lastEditedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

CmsPageSchema.index({ isPublished: 1, showInNav: 1, navOrder: 1 });

export const CmsPage = model<ICmsPage>("CmsPage", CmsPageSchema);
