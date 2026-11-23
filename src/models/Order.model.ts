import { Schema, model, Document, Types } from "mongoose";

export interface IOrderItem {
  productId: Types.ObjectId;
  sellerId?: Types.ObjectId;
  brandName?: string;
  title?: string;
  quantity: number;
  price: number;
  isWholesale?: boolean;
}

export interface IOrder extends Document {
  buyerId: Types.ObjectId; // Linked to User model
  orderItems: IOrderItem[];
  totalAmount: number;
  platformCommissionRate: number; // e.g. 0.05 (5%)
  platformCommission: number; // BDSisters commission cut
  sellerEarnings: number; // Net amount payable to seller sisters
  shippingAddress: {
    district: string;
    state: string;
    addressDetails: string;
    phone: string;
  };
  paymentStatus: "Pending" | "Paid" | "Failed" | "Cancelled";
  orderStatus: "Pending" | "Processing" | "Shipped" | "Delivered" | "Cancelled";
  transactionId?: string;
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
        sellerId: { type: Schema.Types.ObjectId, ref: "User" },
        brandName: { type: String },
        title: { type: String },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
        isWholesale: { type: Boolean, default: false },
      },
    ],
    totalAmount: { type: Number, required: true, min: 0 },
    platformCommissionRate: { type: Number, default: 0.05 }, // 5% default commission
    platformCommission: { type: Number, default: 0 },
    sellerEarnings: { type: Number, default: 0 },
    shippingAddress: {
      district: { type: String, required: true },
      state: { type: String, required: true },
      addressDetails: { type: String, required: true },
      phone: { type: String, required: true },
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Cancelled"],
      default: "Pending",
    },
    orderStatus: {
      type: String,
      enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Pending",
    },
    transactionId: { type: String },
  },
  { timestamps: true }
);

OrderSchema.index({ buyerId: 1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ orderStatus: 1 });
OrderSchema.index({ "orderItems.sellerId": 1 });
OrderSchema.index({ transactionId: 1 });

export const Order = model<IOrder>("Order", OrderSchema);
