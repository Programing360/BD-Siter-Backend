import { z } from "zod";

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name must be at least 2 characters").optional(),
    name: z.string().trim().min(2, "Full name must be at least 2 characters").optional(),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    profilePicture: z
      .string()
      .url("Profile picture must be a valid URL")
      .optional(),
    district: z.string().optional().default("Dhaka"),
    state: z.string().optional().default("Dhaka"),
    country: z.string().optional().default("Bangladesh"),
    referralCode: z.string().optional(),
    docType: z.enum(["NID", "PASSPORT", "ACADEMIC"]).optional(),
    idNumber: z.string().optional(),
    nidOrPassportUrl: z
      .string()
      .url("NID or Passport document URL is required for verification"),
    backImageUrl: z.string().url().nullable().optional(),
  })
  .refine((data) => Boolean(data.fullName || data.name), {
    message: "Full name is required.",
    path: ["fullName"],
  });

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const verifyEmailSchema = z.object({
  token: z.string().optional(),
  otp: z.string().optional(),
  email: z.string().email("Invalid email address").optional(),
}).refine((data) => Boolean(data.token || (data.otp && data.email)), {
  message: "Either verification token or email with 6-digit OTP is required.",
  path: ["otp"],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "New password must be at least 8 characters"),
});

export const resendVerificationSchema = z.object({
  email: z.string().email("Invalid email address"),
});