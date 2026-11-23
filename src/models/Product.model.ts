import { Schema, model, Document, Types } from "mongoose";

export interface IProduct extends Document {
  businessId: Types.ObjectId; // Linked to Business model
  sellerId: Types.ObjectId; // Linked to User model (Owner Sister)
  brandName: string; // Brand reference
  title: string;
  description: string;
  category: "Product" | "Service";
  mrpPrice: number; // Maximum Retail Price
  salePrice: number; // Special discounted price (must be <= mrpPrice)
  price: number; // Current active price (points to salePrice for backward compatibility)
  wholesalePrice?: number;
  isWholesaleEligible: boolean;
  stock: number;
  images: string[];
  productRating: number; // Average product rating (1-5)
  brandRating: number; // Average brand rating (1-5)
  totalReviews: number;
  isAvailable: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    brandName: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ["Product", "Service"],
      required: true,
      default: "Product",
    },
    mrpPrice: { type: Number, required: true, min: 0 },
    salePrice: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function (this: any, val: number) {
          if (this && typeof this.mrpPrice === "number") {
            return val <= this.mrpPrice;
          }
          return true;
        },
        message: "Sale price must be equal to or less than MRP price.",
      },
    },
    price: { type: Number, required: true, min: 0 },
    wholesalePrice: { type: Number, min: 0 },
    isWholesaleEligible: { type: Boolean, default: false },
    stock: { type: Number, required: true, min: 0, default: 0 },
    images: [{ type: String }],
    productRating: { type: Number, default: 0, min: 0, max: 5 },
    brandRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Pre-save hook to ensure price equals salePrice
ProductSchema.pre("save", function () {
  const doc = this as unknown as IProduct;
  if (doc) {
    doc.price = doc.salePrice;
  }
});

ProductSchema.index({ category: 1 });
ProductSchema.index({ brandName: 1 });
ProductSchema.index({ sellerId: 1 });
ProductSchema.index({ businessId: 1 });
ProductSchema.index({ isAvailable: 1, isDeleted: 1 });
ProductSchema.index({ title: "text", description: "text" });

export const Product = model<IProduct>("Product", ProductSchema);
