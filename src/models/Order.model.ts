import { Schema, model, Document } from "mongoose";

export interface IOrder extends Document {
  buyerId: Schema.Types.ObjectId; // Linked to User model
  orderItems: {
    productId: Schema.Types.ObjectId;
    quantity: number;
    price: number;
  }[];
  totalAmount: number;
  shippingAddress: {
    district: string;
    state: string;
    addressDetails: string;
    phone: string;
  };
  paymentStatus: "Pending" | "Paid" | "Failed";
  orderStatus: "Pending" | "Processing" | "Shipped" | "Delivered" | "Cancelled";
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    orderItems: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
      },
    ],
    totalAmount: { type: Number, required: true },
    shippingAddress: {
      district: { type: String, required: true },
      state: { type: String, required: true },
      addressDetails: { type: String, required: true },
      phone: { type: String, required: true },
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },
    orderStatus: {
      type: String,
      enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Pending",
    },
  },
  { timestamps: true },
);

export const Order = model<IOrder>("Order", OrderSchema);
