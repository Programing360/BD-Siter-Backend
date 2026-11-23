import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/User.model";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resendVerificationSchema,
  resetPasswordSchema,
} from "../validations/auth.validation";
import {
  updateProfileSchema,
  updateContactSchema,
} from "../validations/user.validation";
import { sendEmail, emailTemplates } from "../utils/sendEmail";
import { generateProfilePdfBuffer } from "../utils/pdfGenerator";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// Normalize legacy/lowercase roles to match User.model.ts enum
const normalizeUserRole = (user: any) => {
  if (!user?.role) return;
  const roleMap: Record<string, string> = {
    member: "Member",
    freemember: "Member",
    paidmember: "PaidMember",
    admin: "Admin",
    superadmin: "SuperAdmin",
    super_admin: "SuperAdmin",
    guest: "Guest",
  };
  const mapped = roleMap[String(user.role).toLowerCase()];
  if (mapped) {
    user.role = mapped;
  }
};

// ─── Register Controller ──────────────────────────────────────────────────────
export const registerUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const validationResult = registerSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const {
      fullName,
      email,
      password,
      district,
      state,
      country,
      nidOrPassportUrl,
    } = validationResult.data;

    console.log(validationResult);

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res
        .status(400)
        .json({ success: false, message: "Email is already registered." });
      return;
    }

    // Referred by code (from referral middleware or request body)
    const referredBy = req.body._referrerCode || req.body.referralCode || null;

    // Check if this is the first user (can be auto-assigned SuperAdmin if needed)
    const totalUsers = await User.countDocuments();
    const role = totalUsers === 0 ? "SuperAdmin" : "Member";
    const status = totalUsers === 0 ? "Active" : "Pending";

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user instance
    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      location: { district, state, country },
      contactInfo: { emails: [email], isPrivate: true },
      identityVerification: {
        nidOrPassportUrl,
        verificationStatus: totalUsers === 0 ? "Approved" : "Pending",
      },
      referredBy,
      role,
      status,
      isEmailVerified: totalUsers === 0, // auto-verify first user
    });

    // Generate email verification token if not first user
    let rawVerificationToken = "";
    if (totalUsers > 0) {
      rawVerificationToken = newUser.generateEmailVerificationToken();
    }

    await newUser.save();

    // Send verification email
    if (rawVerificationToken) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const verifyUrl = `${frontendUrl}/verify-email?token=${rawVerificationToken}`;
      const template = emailTemplates.verifyEmail(newUser.fullName, verifyUrl);

      try {
        await sendEmail({
          to: newUser.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });
      } catch (emailErr) {
        console.error(
          "Failed to send verification email:",
          (emailErr as Error).message,
        );
      }
    }

    res.status(201).json({
      success: true,
      message:
        totalUsers === 0
          ? "First user registered successfully as SuperAdmin!"
          : "Registration successful! Please check your email to verify your address. Your account is pending admin approval.",
      data: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        referralCode: newUser.referralCode,
        isEmailVerified: newUser.isEmailVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
// ─── Resend Verification Email Controller ────────────────────────────────────
export const resendVerificationEmail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const validationResult = resendVerificationSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { email } = validationResult.data;
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // সিকিউরিটির জন্য ইউজার না থাকলেও জেনেরিক সাকসেস মেসেজ রিটার্ন করা ভালো
    if (!user) {
      res.status(200).json({
        success: true,
        message:
          "If that email is registered, a verification link has been sent.",
      });
      return;
    }

    if (user.isEmailVerified) {
      res.status(400).json({
        success: false,
        message: "This email address is already verified. You can log in.",
      });
      return;
    }

    // নতুন ভেরিফিকেশন টোকেন জেনারেট ও সেভ করা
    const rawVerificationToken = user.generateEmailVerificationToken();
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const verifyUrl = `${frontendUrl}/verify-email?token=${rawVerificationToken}`;
    const template = emailTemplates.verifyEmail(user.fullName, verifyUrl);

    await sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    res.status(200).json({
      success: true,
      message: "Verification email sent! Please check your inbox.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Login Controller ─────────────────────────────────────────────────────────
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Please provide a valid email address and password.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const { email, password } = validationResult.data;

    // Must explicitly select password because password has select: false
    const user = await User.findOne({ email }).select("+password");
    if (!user || !user.password) {
      res.status(400).json({
        success: false,
        message:
          "No account found with this email, or the password you entered is incorrect. Please check and try again.",
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).json({
        success: false,
        message:
          "Incorrect password. Please try again or use 'Forgot password' to reset it.",
      });
      return;
    }

    // Email verification check
    if (!user.isEmailVerified) {
      res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message:
          "Your email address is not verified yet. Please check your inbox (or spam folder) for the verification link before signing in.",
      });
      return;
    }

    console.log(user);

    // Status security checks
    if (user.status === "Pending") {
      res.status(403).json({
        success: false,
        code: "ACCOUNT_PENDING",
        message:
          "Your account is currently under review. Our verification team is checking your submitted identity documents, and you will receive an email once approved.",
      });
      return;
    }

    if (user.status === "Suspended") {
      res.status(403).json({
        success: false,
        code: "ACCOUNT_SUSPENDED",
        message:
          "Your account has been temporarily suspended due to a policy or security review. Please contact BDSisters support for assistance.",
      });
      return;
    }

    if (user.status === "Rejected") {
      res.status(403).json({
        success: false,
        code: "ACCOUNT_REJECTED",
        message:
          "Your membership application could not be approved because your identity verification did not meet our requirements. Please contact support for details.",
      });
      return;
    }

    // Sign JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      res.status(500).json({
        success: false,
        message:
          "Internal server authentication error. Please try again later.",
      });
      return;
    }

    const expiresIn = (process.env.JWT_EXPIRES_IN ||
      "7d") as SignOptions["expiresIn"];
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        status: user.status,
      },
      jwtSecret,
      { expiresIn },
    );

    res.status(200).json({
      success: true,
      message: `Welcome back, ${user.fullName}! Login successful.`,
      token,
      data: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        referralCode: user.referralCode,
        profilePicture: user.profilePicture,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        (error as Error).message ||
        "An unexpected error occurred during login.",
    });
  }
};

// ─── Verify Email Controller ──────────────────────────────────────────────────
export const verifyEmail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const validationResult = verifyEmailSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { token } = validationResult.data;
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    }).select("+emailVerificationToken +emailVerificationExpires");

    if (!user) {
      res.status(400).json({
        success: false,
        message: "Invalid or expired email verification link.",
      });
      return;
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Email address verified successfully!",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Forgot Password Controller ───────────────────────────────────────────────
export const forgotPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const validationResult = forgotPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { email } = validationResult.data;
    const user = await User.findOne({ email });

    // Always respond with success to avoid email enumeration
    if (!user) {
      res.status(200).json({
        success: true,
        message:
          "If that email is registered, a password reset link has been sent.",
      });
      return;
    }

    const rawResetToken = user.generatePasswordResetToken();
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password?token=${rawResetToken}`;
    const template = emailTemplates.resetPassword(user.fullName, resetUrl);

    try {
      await sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    } catch (emailErr) {
      console.error(
        "Failed to send password reset email:",
        (emailErr as Error).message,
      );
    }

    res.status(200).json({
      success: true,
      message:
        "If that email is registered, a password reset link has been sent.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Reset Password Controller ────────────────────────────────────────────────
export const resetPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const validationResult = resetPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { token, password } = validationResult.data;
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select("+passwordResetToken +passwordResetExpires");

    if (!user) {
      res.status(400).json({
        success: false,
        message: "Invalid or expired password reset link.",
      });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message:
        "Password reset successfully! You can now log in with your new password.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Logout Controller ────────────────────────────────────────────────────────
export const logoutUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
};

// ─── Get Current User Profile (/me) ───────────────────────────────────────────
export const getMe = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    // Owner can view their own private frameworks & own uploaded NID URL
    const user = await User.findById(req.user.id).select(
      "+chart8020Data +islamicDevWheelData +identityVerification.nidOrPassportUrl",
    );
    if (!user) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Update Current User Profile (PATCH /me) ──────────────────────────────────
export const updateMe = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    const validationResult = updateProfileSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const user = await User.findById(req.user.id).select(
      "+chart8020Data +islamicDevWheelData",
    );
    if (!user) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    // Fix legacy role enum error before save()
    normalizeUserRole(user);

    const data = validationResult.data as Record<string, any>;

    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.bio !== undefined) user.bio = data.bio;
    if (data.profilePicture !== undefined)
      user.profilePicture = data.profilePicture;
    if (data.location !== undefined) user.location = data.location;
    if (data.webProfiles !== undefined) user.webProfiles = data.webProfiles;
    if (data.subjectsOfInterest !== undefined)
      user.subjectsOfInterest = data.subjectsOfInterest;
    if (data.softwareSkills !== undefined)
      user.softwareSkills = data.softwareSkills;
    if (data.vocationalSkills !== undefined)
      user.vocationalSkills = data.vocationalSkills;
    if (data.chart8020Data !== undefined)
      user.chart8020Data = data.chart8020Data;
    if (data.islamicDevWheelData !== undefined)
      user.islamicDevWheelData = data.islamicDevWheelData;

    // Support Confidential NID / Passport Upload update
    const nidUrl =
      req.body.nidOrPassportUrl ||
      req.body.identityVerification?.nidOrPassportUrl;
    if (nidUrl) {
      user.identityVerification = {
        ...user.identityVerification,
        nidOrPassportUrl: nidUrl,
        verificationStatus: "Pending",
      };
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully!",
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Update Contact Information (PATCH /me/contact) ───────────────────────────
export const updateContact = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    const validationResult = updateContactSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    normalizeUserRole(user);

    const { phone, whatsapp, emails, isPrivate } = validationResult.data;

    if (phone !== undefined) user.contactInfo.phone = phone;
    if (whatsapp !== undefined) user.contactInfo.whatsapp = whatsapp;
    if (emails !== undefined) user.contactInfo.emails = emails;
    if (isPrivate !== undefined) user.contactInfo.isPrivate = isPrivate;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Contact info updated successfully!",
      data: user.contactInfo,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Submit Profile For Review (POST /me/submit-review) ───────────────────────
export const submitProfileForReview = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    normalizeUserRole(user);

    if (user.profileStatus === "PendingReview") {
      res.status(400).json({
        success: false,
        message: "Your profile is already submitted and pending review.",
      });
      return;
    }

    if (user.profileStatus === "Active") {
      res.status(400).json({
        success: false,
        message: "Your profile is already approved and active.",
      });
      return;
    }

    user.profileStatus = "PendingReview";
    await user.save();

    res.status(200).json({
      success: true,
      message:
        "Profile submitted for review successfully! Admin will review your profile shortly.",
      data: {
        id: user._id,
        profileStatus: user.profileStatus,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Export Member Profile as PDF ─────────────────────────────────────────────
export const exportProfilePdf = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    const pdfBuffer = await generateProfilePdfBuffer(user);
    const filename = `${(user.fullName || "Member").replace(/[^a-zA-Z0-9]/g, "_")}_Profile.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
