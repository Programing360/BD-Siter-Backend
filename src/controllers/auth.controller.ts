import { Request, Response, CookieOptions } from "express";
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

// ─── Cookie Options Helper ────────────────────────────────────────────────────
const getAuthCookieOptions = (): CookieOptions => {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
};

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
      name,
      email,
      password,
      district,
      state,
      country,
      nidOrPassportUrl,
      docType,
      idNumber,
      backImageUrl,
    } = validationResult.data;

    const resolvedFullName = (fullName || name || req.body.fullName || req.body.name || "").trim();
    const resolvedDocType = docType || req.body.docType || "NID";
    const resolvedIdNumber = (idNumber || req.body.idNumber || "").trim();
    const resolvedBackImageUrl = backImageUrl || req.body.backImageUrl || undefined;

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
      fullName: resolvedFullName,
      email,
      password: hashedPassword,
      location: { district, state, country },
      contactInfo: { emails: [email], isPrivate: true },
      identityVerification: {
        docType: resolvedDocType,
        idNumber: resolvedIdNumber,
        nidOrPassportUrl,
        backImageUrl: resolvedBackImageUrl,
        verificationStatus: totalUsers === 0 ? "Approved" : "Pending",
      },
      referredBy,
      role,
      status,
      isEmailVerified: totalUsers === 0, // auto-verify first user
    });

    // Generate email verification token & 6-digit OTP if not first user
    let rawVerificationToken = "";
    let generatedOtp = "";
    if (totalUsers > 0) {
      generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      newUser.emailVerificationOtp = generatedOtp;
      newUser.emailVerificationOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      rawVerificationToken = newUser.generateEmailVerificationToken();
    }

    await newUser.save();

    // Send verification email with 6-digit OTP
    if (generatedOtp) {
      console.log(`[OTP Dispatch] Sending OTP to ${newUser.email} (Code: ${generatedOtp})`);
      const template = emailTemplates.verifyOtp(newUser.fullName, generatedOtp);

      try {
        await sendEmail({
          to: newUser.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });
        console.log(`[OTP Dispatch] Successfully dispatched verification OTP to ${newUser.email}`);
      } catch (emailErr) {
        console.error(
          `[OTP Dispatch Error] Failed to send OTP email to ${newUser.email}:`,
          (emailErr as Error).message,
        );
      }
    }

    res.status(201).json({
      success: true,
      message:
        totalUsers === 0
          ? "First user registered successfully as SuperAdmin!"
          : "Registration successful! A 6-digit verification code has been sent to your email.",
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

    if (!user) {
      res.status(200).json({
        success: true,
        message:
          "If that email is registered, a verification code has been sent.",
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

    // Generate fresh 6-digit OTP (10 mins) and token
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailVerificationOtp = generatedOtp;
    user.emailVerificationOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    const rawVerificationToken = user.generateEmailVerificationToken();
    await user.save();

    console.log(`[OTP Dispatch] Sending OTP to ${user.email} (Code: ${generatedOtp})`);
    const template = emailTemplates.verifyOtp(user.fullName, generatedOtp);

    try {
      await sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
      console.log(`[OTP Dispatch] Successfully dispatched fresh OTP to ${user.email}`);

      res.status(200).json({
        success: true,
        message: "Verification code sent! Please check your email inbox.",
      });
    } catch (emailErr) {
      console.error(
        `[OTP Dispatch Error] Failed to send OTP to ${user.email}:`,
        (emailErr as Error).message,
      );

      res.status(500).json({
        success: false,
        message: `Failed to deliver verification email: ${(emailErr as Error).message || "SMTP error"}`,
      });
    }
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

    // Set secure HttpOnly cookie directly from backend
    res.cookie("token", token, getAuthCookieOptions());

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

// ─── Verify Email Controller (Supports 6-Digit OTP and Legacy Token) ─────────
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

    const { token, otp, email } = validationResult.data;
    let user: any = null;

    if (otp && email) {
      // 1. Verify via 6-Digit OTP
      const cleanEmail = email.toLowerCase().trim();
      const cleanOtp = otp.trim();

      user = await User.findOne({
        email: cleanEmail,
        emailVerificationOtp: cleanOtp,
        emailVerificationOtpExpires: { $gt: new Date() },
      }).select("+emailVerificationOtp +emailVerificationOtpExpires");

      if (!user) {
        res.status(400).json({
          success: false,
          message: "Invalid or expired 6-digit verification code. Please request a new code.",
        });
        return;
      }
    } else if (token) {
      // 2. Verify via Legacy Link Token
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

      user = await User.findOne({
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
    } else {
      res.status(400).json({
        success: false,
        message: "Please provide either your 6-digit verification code or token.",
      });
      return;
    }

    // Mark email as verified and clear OTP/token fields
    user.isEmailVerified = true;
    user.emailVerificationOtp = undefined;
    user.emailVerificationOtpExpires = undefined;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Auto-login: Sign JWT & set HttpOnly cookie
    const jwtSecret = process.env.JWT_SECRET;
    let authToken = "";
    if (jwtSecret) {
      const expiresIn = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];
      authToken = jwt.sign(
        {
          id: user._id,
          role: user.role,
          status: user.status,
        },
        jwtSecret,
        { expiresIn },
      );
      res.cookie("token", authToken, getAuthCookieOptions());
    }

    res.status(200).json({
      success: true,
      message: "Email address verified successfully!",
      token: authToken,
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
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
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
  _req: Request,
  res: Response,
): Promise<void> => {
  const isProd = process.env.NODE_ENV === "production";
  const clearOptions: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };

  res.clearCookie("token", clearOptions);
  res.clearCookie("auth_token", clearOptions);

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