import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { User } from "../models/User.model";
import { registerSchema, loginSchema } from "../validations/auth.validation";

// Register Controller
export const registerUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Zod validation check
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
      profilePicture,
      district,
      state,
      country,
      referredBy,
      nidOrPassportUrl,
    } = validationResult.data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res
        .status(400)
        .json({ success: false, message: "Email is already registered." });
      return;
    }

    // (নোট: রেফারেল চেকটি এখন মিডলওয়্যারে হচ্ছে, তাই কন্ট্রোলার থেকে এটি সরিয়ে নেওয়া হয়েছে)

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user (Default role: Member, Status: Pending)
    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      profilePicture,
      location: { district, state, country },
      contactInfo: { emails: [email], isPrivate: true },
      identityVerification: { nidOrPassportUrl, isVerified: false },
      referredBy,
      role: "Member",
      status: "Pending",
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message:
        "Registration successful! Your account is pending review by the admin.",
      data: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        status: newUser.status,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// Login Controller
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { email, password } = validationResult.data;

    const user = await User.findOne({ email });
    if (!user) {
      res
        .status(400)
        .json({ success: false, message: "Invalid email or password." });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password as string);
    if (!isMatch) {
      res
        .status(400)
        .json({ success: false, message: "Invalid email or password." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Login successful!",
      data: {
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
