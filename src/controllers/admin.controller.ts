import { Request, Response } from "express";
import { User } from "../models/User.model";
import { Business } from "../models/Business.model";
import {
  updateApprovalStatusSchema,
  updateSubscriptionStatusSchema,
} from "../validations/admin.validation";

// Get All Pending Users for Approval
export const getPendingUsers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const pendingUsers = await User.find({ status: "Pending" }).select(
      "-password",
    );
    res.status(200).json({
      success: true,
      count: pendingUsers.length,
      data: pendingUsers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// Update User Approval Status (Active / Rejected)
export const updateUserStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = req.params;
    const validationResult = updateApprovalStatusSchema.safeParse(req.body);

    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { status } = validationResult.data;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    user.status = status;
    if (status === "Active") {
      user.identityVerification.isVerified = true; // Automatically mark verified when approved
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: `User status updated to ${status} successfully!`,
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// Get All Businesses (for Admin tracking)
export const getAllBusinessesForAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const businesses = await Business.find().populate(
      "userId",
      "fullName email status",
    );
    res.status(200).json({
      success: true,
      count: businesses.length,
      data: businesses,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// Update Business Subscription Status (Unpaid -> Paid / Publish Brands)
export const updateBusinessSubscription = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { businessId } = req.params;
    const validationResult = updateSubscriptionStatusSchema.safeParse(req.body);

    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { subscriptionStatus } = validationResult.data;

    const business = await Business.findById(businessId);
    if (!business) {
      res
        .status(404)
        .json({ success: false, message: "Business profile not found." });
      return;
    }

    business.subscriptionStatus = subscriptionStatus;

    // If subscription is Paid, automatically publish all brands under this business
    if (subscriptionStatus === "Paid") {
      business.brands.forEach((brand) => {
        brand.isPublished = true;
      });
    } else {
      business.brands.forEach((brand) => {
        brand.isPublished = false;
      });
    }

    await business.save();

    res.status(200).json({
      success: true,
      message: `Business subscription updated to ${subscriptionStatus} successfully!`,
      data: business,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
