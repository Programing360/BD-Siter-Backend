import { Schema, model, Document, Types } from "mongoose";

export interface IReview extends Document {
  productId: Types.ObjectId;
  businessId: Types.ObjectId;
  buyerId: Types.ObjectId;
  productRating: number; // 1 to 5
  brandRating: number; // 1 to 5
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    buyerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    brandRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

ReviewSchema.index({ productId: 1, buyerId: 1 }, { unique: true });
ReviewSchema.index({ businessId: 1 });

export const Review = model<IReview>("Review", ReviewSchema);
