import { Schema, model, Document, Types } from "mongoose";

export interface IBusiness extends Document {
  userId: Types.ObjectId; // Linked to User model (must have personal profile)
  brands: {
    brandName: string;
    roleInBusiness: string; // Founder, CEO, or custom 'Other'
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
  }[];
  subscriptionStatus: "Unpaid" | "Paid";
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema = new Schema<IBusiness>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    brands: [
      {
        brandName: { type: String, required: true },
        roleInBusiness: { type: String, required: true }, // e.g., Founder, CEO, or Custom
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
    ],
    subscriptionStatus: {
      type: String,
      enum: ["Unpaid", "Paid"],
      default: "Unpaid",
    },
  },
  { timestamps: true },
);

export const Business = model<IBusiness>("Business", BusinessSchema);
