import { Schema, model, Document, Types } from "mongoose";

export interface IBrand {
  _id?: Types.ObjectId;
  brandName: string;
  roleInBusiness: string; // Founder, CEO, or 'Other'
  customRoleTitle?: string; // Required when roleInBusiness is 'Other'
  contactInfo: {
    phone?: string;
    email?: string;
    address?: string;
  };
  businessSummary: string;
  servicesOrProducts: string[];
  portfolioOrGallery: string[];
  testimonialsAndReviews: {
    user: string;
    comment: string;
    rating: number;
  }[];
  websiteLinks: string[]; // Commission for BDSisters.org if clicked
  isPublished: boolean; // Needs subscription fee to publish
}

export interface ISubscriptionHistory {
  status: string;
  paidAt: Date;
  amount: number;
  transactionId: string;
}

export interface IWebsiteLinkClick {
  brandId?: Types.ObjectId;
  url: string;
  clickCount: number;
  lastClickedAt?: Date;
}

export interface IBusiness extends Document {
  userId: Types.ObjectId; // Linked to User model (must have personal profile)
  brands: Types.DocumentArray<IBrand & Types.Subdocument>;
  subscriptionStatus: "Unpaid" | "Paid";
  subscriptionExpiresAt?: Date;
  subscriptionHistory: ISubscriptionHistory[];
  websiteLinkClicks: IWebsiteLinkClick[];
  createdAt: Date;
  updatedAt: Date;
}

const BrandSchema = new Schema<IBrand>(
  {
    brandName: { type: String, required: true },
    roleInBusiness: { type: String, required: true }, // e.g., Founder, CEO, or Other
    customRoleTitle: { type: String },
    contactInfo: {
      phone: { type: String },
      email: { type: String },
      address: { type: String },
    },
    businessSummary: { type: String, required: true, maxlength: 500 },
    servicesOrProducts: [{ type: String }],
    portfolioOrGallery: [{ type: String }],
    testimonialsAndReviews: [
      {
        user: { type: String },
        comment: { type: String },
        rating: { type: Number, min: 1, max: 5 },
      },
    ],
    websiteLinks: [{ type: String }],
    isPublished: { type: Boolean, default: false }, // Requires subscription fee before publishing
  },
  { timestamps: true }
);

const BusinessSchema = new Schema<IBusiness>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    brands: [BrandSchema],
    subscriptionStatus: {
      type: String,
      enum: ["Unpaid", "Paid"],
      default: "Unpaid",
    },
    subscriptionExpiresAt: { type: Date },
    subscriptionHistory: [
      {
        status: { type: String, required: true },
        paidAt: { type: Date, default: Date.now },
        amount: { type: Number, required: true },
        transactionId: { type: String, required: true },
      },
    ],
    websiteLinkClicks: [
      {
        brandId: { type: Schema.Types.ObjectId },
        url: { type: String, required: true },
        clickCount: { type: Number, default: 0 },
        lastClickedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

BusinessSchema.index({ subscriptionStatus: 1 });

export const Business = model<IBusiness>("Business", BusinessSchema);
