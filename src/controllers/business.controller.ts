import { Request, Response } from "express";
import mongoose from "mongoose";
import { Business } from "../models/Business.model";
import { User } from "../models/User.model";
import { createBusinessProfileSchema } from "../validations/business.validation";

// Create or Add Brands to Business Profile
export const createOrUpdateBusiness = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const validationResult = createBusinessProfileSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { userId, brands } = validationResult.data;

    // Validate that userId is a valid ObjectId before querying
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ success: false, message: "Invalid user ID format." });
      return;
    }

    const objectUserId = new mongoose.Types.ObjectId(userId);

    // Rule Check: Linked with personal profile (Only members with a personal profile can build business profile)
    const userExists = await User.findById(objectUserId);
    if (!userExists) {
      res.status(404).json({
        success: false,
        message:
          "Personal profile not found. You must have a registered personal profile to create a business profile.",
      });
      return;
    }

    let businessProfile = await Business.findOne({ userId: objectUserId } as any);

    if (businessProfile) {
      // If business profile exists, push new brands to the array
      // Note: Sisters can create business profile for free but need subscription fee before publishing
      (businessProfile as InstanceType<typeof Business>).brands.push(...(brands as any));
      await businessProfile.save();
      res.status(200).json({
        success: true,
        message: "New brand(s) added successfully to your business profile.",
        data: businessProfile,
      });
    } else {
      // Create new business profile document
      businessProfile = new Business({
        userId: objectUserId,
        brands,
        subscriptionStatus: "Unpaid", // Default unpaid until subscription fee is paid
      });
      await businessProfile.save();

      res.status(201).json({
        success: true,
        message:
          "Business profile created successfully! Please pay the subscription fee to publish your brands.",
        data: businessProfile,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
