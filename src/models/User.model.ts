import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  fullName: string;
  email: string;
  password?: string;
  profilePicture: string; // Big square profile picture
  bio?: string;
  location: {
    district: string;
    state: string;
    country: string;
  };
  contactInfo: {
    phone?: string;
    whatsapp?: string;
    emails: string[];
    isPrivate: boolean; // Default true unless checked
  };
  identityVerification: {
    nidOrPassportUrl: string; // Admin-only access
    isVerified: boolean;
  };
  referredBy: string; // Mandatory referral requirement
  role: "Guest" | "Member" | "PaidMember" | "Admin";
  status: "Pending" | "Active" | "Suspended" | "Rejected";
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String, required: true }, // Big square image URL
    bio: { type: String, maxlength: 300 },
    location: {
      district: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true },
    },
    contactInfo: {
      phone: { type: String },
      whatsapp: { type: String },
      emails: [{ type: String }],
      isPrivate: { type: Boolean, default: true },
    },
    identityVerification: {
      nidOrPassportUrl: { type: String, required: true },
      isVerified: { type: Boolean, default: false },
    },
    referredBy: { type: String, required: true }, // Mandatory referrer name/ID
    role: {
      type: String,
      enum: ["Guest", "Member", "PaidMember", "Admin"],
      default: "Member",
    },
    status: {
      type: String,
      enum: ["Pending", "Active", "Suspended"],
      default: "Pending",
    },
  },
  { timestamps: true },
);

export const User = model<IUser>("User", UserSchema);
