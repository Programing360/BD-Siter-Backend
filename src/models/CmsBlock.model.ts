import { Schema, model, Document, Types } from "mongoose";

export interface ICmsBlock extends Document {
  sectionKey: string; // e.g. "hero", "wings", "keyAreas", "sectionExplainer", "whoWeAre"
  blockType: string;  // e.g. "hero", "wing", "keyArea", "explainer", "info"
  title: string;
  subtitle?: string;
  content: string;
  order: number;
  isPublished: boolean;
  imageUrl?: string;
  hoverTooltip?: string;
  ctaText?: string;
  ctaLink?: string;
  metadata?: Record<string, any>;
  lastEditedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CmsBlockSchema = new Schema<ICmsBlock>(
  {
    sectionKey: { type: String, required: true, trim: true, index: true },
    blockType: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    content: { type: String, default: "" },
    order: { type: Number, default: 0, index: true },
    isPublished: { type: Boolean, default: true, index: true },
    imageUrl: { type: String },
    hoverTooltip: { type: String, default: "" },
    ctaText: { type: String },
    ctaLink: { type: String },
    metadata: { type: Schema.Types.Mixed },
    lastEditedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

CmsBlockSchema.index({ sectionKey: 1, order: 1 });
CmsBlockSchema.index({ isPublished: 1, sectionKey: 1 });

export const CmsBlock = model<ICmsBlock>("CmsBlock", CmsBlockSchema);
