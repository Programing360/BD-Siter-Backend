import { Schema, model, Document, Types } from "mongoose";
import crypto from "crypto";

// ─── Sub-Interfaces ───────────────────────────────────────────────────────────

export interface IWebProfile {
  label: string;
  url: string;
  iconType?: string;
}

export interface ISubjectOfInterest {
  genre: string;
  subject: string;
}

export interface ISoftwareSkill {
  name: string;
  level: number; // 1 to 5
}

export interface IVocationalSkill {
  genre: string;
  skill: string;
  level: number; // 1 to 5
}

export interface IVerificationAuditLog {
  action: string;
  adminId: Types.ObjectId;
  timestamp: Date;
  notes?: string;
}

// ─── Main User Interface ──────────────────────────────────────────────────────

export interface IUser extends Document {
  // Core identity
  fullName: string;
  email: string;
  password?: string;
  profilePicture?: string;
  bio?: string;
  wings?: string[];

  // Location (only District, State, Country — no street address)
  location: {
    district: string;
    state: string;
    country: string;
  };

  // Contact info — MUST default to private unless explicitly toggled public
  contactInfo: {
    phone?: string;
    whatsapp?: string;
    emails: string[];
    isPrivate: boolean;
  };

  // Web profiles & social links
  webProfiles: IWebProfile[];

  // Skill sets & interests
  subjectsOfInterest: ISubjectOfInterest[];
  softwareSkills: ISoftwareSkill[];
  vocationalSkills: IVocationalSkill[];

  // Always-private frameworks (never exposed publicly)
  chart8020Data?: Record<string, unknown>;
  islamicDevWheelData?: Record<string, unknown>;

  // Identity verification (Admin-only access for documents)
  identityVerification: {
    nidOrPassportUrl: string;
    verificationStatus: "Pending" | "Approved" | "Rejected";
    verificationNote?: string;
    auditLog: IVerificationAuditLog[];
  };

  // Referral
  referralCode: string;
  referredBy?: string;

  // RBAC & Account Status
  role: "Guest" | "Member" | "PaidMember" | "Admin" | "SuperAdmin";
  status: "Draft" | "Pending" | "Active" | "Suspended" | "Rejected";
  profileStatus:
    | "Draft"
    | "PendingReview"
    | "Active"
    | "Rejected"
    | "Suspended";

  // Email verification
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;

  // Password reset
  passwordResetToken?: string;
  passwordResetExpires?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  generateEmailVerificationToken(): string;
  generatePasswordResetToken(): string;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const UserSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    profilePicture: { type: String, default: "" },
    bio: { type: String, maxlength: 300 },
    wings: [{ type: String }],

    location: {
      district: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true },
    },

    contactInfo: {
      phone: { type: String },
      whatsapp: { type: String },
      emails: [{ type: String }],
      isPrivate: { type: Boolean, default: true }, // MUST default to private
    },

    webProfiles: [
      {
        label: { type: String, required: true },
        url: { type: String, required: true },
        iconType: { type: String },
      },
    ],

    subjectsOfInterest: [
      {
        genre: { type: String, required: true },
        subject: { type: String, required: true },
      },
    ],

    softwareSkills: [
      {
        name: { type: String, required: true },
        level: { type: Number, min: 1, max: 5, required: true },
      },
    ],

    vocationalSkills: [
      {
        genre: { type: String, required: true },
        skill: { type: String, required: true },
        level: { type: Number, min: 1, max: 5, required: true },
      },
    ],

    // Always-private frameworks — excluded by default from queries
    chart8020Data: { type: Schema.Types.Mixed, select: false },
    islamicDevWheelData: { type: Schema.Types.Mixed, select: false },

    identityVerification: {
      nidOrPassportUrl: { type: String, required: true, select: false },
      verificationStatus: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending",
      },
      verificationNote: { type: String },
      auditLog: [
        {
          action: { type: String, required: true },
          adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
          timestamp: { type: Date, default: Date.now },
          notes: { type: String },
        },
      ],
    },

    referralCode: { type: String, unique: true },
    referredBy: { type: String, default: null },

    role: {
      type: String,
      enum: ["Guest", "Member", "FreeMember", "PaidMember", "Admin", "SuperAdmin"],
      default: "Member",
    },

    status: {
      type: String,
      enum: ["Draft", "Pending", "Active", "Suspended", "Rejected"],
      default: "Pending",
    },

    profileStatus: {
      type: String,
      enum: ["Draft", "PendingReview", "Active", "Rejected", "Suspended"],
      default: "Draft",
    },

    // Email verification
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },

    // Password reset
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

// ─── Pre-save: auto-generate unique referral code ─────────────────────────────

UserSchema.pre("save", function () {
  if (!this.referralCode) {
    this.referralCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  }
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

UserSchema.methods.generateEmailVerificationToken = function (): string {
  const rawToken = crypto.randomBytes(32).toString("hex");
  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return rawToken;
};

UserSchema.methods.generatePasswordResetToken = function (): string {
  const rawToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  return rawToken;
};

// ─── Indexes ──────────────────────────────────────────────────────────────────

UserSchema.index({ status: 1 });
UserSchema.index({ profileStatus: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ fullName: 1 });
UserSchema.index({ createdAt: -1 });

export const User = model<IUser>("User", UserSchema);
