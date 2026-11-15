import { Schema, model, Document } from "mongoose";

export interface IProduct extends Document {
  businessId: Schema.Types.ObjectId; // Linked to Business model
  brandName: string; // Brand reference
  title: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  images: string[];
  isAvailable: boolean;
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
    brandName: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    category: { type: String, required: true },
    images: [{ type: String }],
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Product = model<IProduct>("Product", ProductSchema);
