import { Schema, model, Document, Types } from "mongoose";

export interface IReview extends Document {
  targetType: "Product" | "Brand" | "Business";
  targetId?: Types.ObjectId;
  productId?: Types.ObjectId;
  businessId?: Types.ObjectId;
  brandId?: Types.ObjectId;
  buyerId: Types.ObjectId;
  reviewerName?: string;
  rating: number; // 1 to 5
  productRating?: number; // 1 to 5
  brandRating?: number; // 1 to 5
  comment: string;
  status: "PUBLISHED" | "PENDING" | "HIDDEN" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    targetType: {
      type: String,
      enum: ["Product", "Brand", "Business"],
      default: "Brand",
    },
    targetId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      index: true,
    },
    brandId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    buyerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reviewerName: {
      type: String,
      trim: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    productRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    brandRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["PUBLISHED", "PENDING", "HIDDEN", "REJECTED"],
      default: "PUBLISHED",
      index: true,
    },
  },
  { timestamps: true }
);

ReviewSchema.index({ targetType: 1, targetId: 1, buyerId: 1 });
ReviewSchema.index({ brandId: 1, buyerId: 1 });

export const Review = model<IReview>("Review", ReviewSchema);
