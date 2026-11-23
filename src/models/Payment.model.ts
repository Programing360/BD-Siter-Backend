import { Schema, model, Document, Types } from "mongoose";

export interface IPayment extends Document {
  transactionId: string;
  invoiceId?: string; // ZiniPay invoice ID (INV-...)
  gateway: string; // "ZiniPay"
  userId: Types.ObjectId;
  paymentType: "BusinessSubscription" | "Order" | "EventTicket";
  referenceId: string; // businessId, orderId, or eventId
  amount: number;
  currency: string;
  status: "Pending" | "Success" | "Failed" | "Cancelled";
  gatewayResponse?: Record<string, any>;
  ipnPayload?: Record<string, any>;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    transactionId: { type: String, required: true, unique: true },
    invoiceId: { type: String },
    gateway: { type: String, default: "ZiniPay" },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    paymentType: {
      type: String,
      enum: ["BusinessSubscription", "Order", "EventTicket"],
      required: true,
    },
    referenceId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "BDT" },
    status: {
      type: String,
      enum: ["Pending", "Success", "Failed", "Cancelled"],
      default: "Pending",
    },
    gatewayResponse: { type: Schema.Types.Mixed },
    ipnPayload: { type: Schema.Types.Mixed },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

PaymentSchema.index({ invoiceId: 1 });
PaymentSchema.index({ userId: 1 });
PaymentSchema.index({ referenceId: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ gateway: 1 });

export const Payment = model<IPayment>("Payment", PaymentSchema);
