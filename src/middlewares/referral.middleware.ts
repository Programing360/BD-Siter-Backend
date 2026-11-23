import { Request, Response, NextFunction } from "express";
import { User } from "../models/User.model";

export const validateReferral = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { referralCode } = req.body;
    const founderCode = (
      process.env.FOUNDER_REFERRAL_CODE || "SISTER-2026"
    ).toUpperCase();

    // ১. ডাটাবেজে কোনো Active মেম্বার না থাকলে (অথবা ০ ইউজার থাকলে) ফাউন্ডার কোড বা প্রথম ইউজার অ্যালাউ করবে
    const activeUsersCount = await User.countDocuments({ status: "Active" });
    if (activeUsersCount === 0) {
      if (referralCode) {
        req.body._referrerCode = referralCode.toString().trim().toUpperCase();
      }
      next();
      return;
    }

    if (!referralCode) {
      res.status(400).json({
        success: false,
        message:
          "A valid referral code is mandatory to register on BDSisters.org.",
      });
      return;
    }

    const normalizedCode = referralCode.toString().trim().toUpperCase();

    // ২. মাস্টার ফাউন্ডার কোড চেক (যদি .env এ সেট করা থাকে)
    if (normalizedCode === founderCode) {
      req.body._referrerCode = founderCode;
      next();
      return;
    }

    // ৩. ডাটাবেজে থাকা Active মেম্বারের রেফারেল কোড চেক
    const referrer = await User.findOne({
      referralCode: normalizedCode,
      status: "Active",
    });

    if (!referrer) {
      res.status(400).json({
        success: false,
        message:
          "Invalid referral code. The referral code must belong to an active registered member of BDSisters.org.",
      });
      return;
    }

    req.body._referrerCode = referrer.referralCode;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
