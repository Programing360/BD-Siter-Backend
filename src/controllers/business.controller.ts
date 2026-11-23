import { Response } from "express";
import mongoose from "mongoose";
import { Business } from "../models/Business.model";
import { User } from "../models/User.model";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import {
  createBusinessProfileSchema,
  updateBrandSchema,
  clickWebsiteLinkSchema,
} from "../validations/business.validation";

// ─── 1. Create or Add Brands to Business Profile (POST /create) ───────────────
export const createOrUpdateBusiness = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const validationResult = createBusinessProfileSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const targetUserId = req.user?.id || validationResult.data.userId;
    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ success: false, message: "Valid User ID is required." });
      return;
    }

    const objectUserId = new mongoose.Types.ObjectId(targetUserId);

    // Rule Check: User must have a personal profile
    const userExists = await User.findById(objectUserId);
    if (!userExists) {
      res.status(404).json({
        success: false,
        message:
          "Personal profile not found. You must have a registered personal profile to create a business profile.",
      });
      return;
    }

    const { brands } = validationResult.data;

    let businessProfile = await Business.findOne({ userId: objectUserId });

    if (businessProfile) {
      // Push new brands to existing business profile
      for (const b of brands) {
        businessProfile.brands.push(b as any);
      }
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

// ─── 2. Get Own Business Profile (GET /my) ────────────────────────────────────
export const getMyBusiness = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const business = await Business.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
    }).populate("userId", "fullName email role status profilePicture");

    if (!business) {
      res.status(404).json({
        success: false,
        message: "You have not created a business profile yet.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: business,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 3. Get Public Business Profile (GET /:id) ────────────────────────────────
export const getBusinessById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid business ID format." });
      return;
    }

    const business = await Business.findById(id).populate(
      "userId",
      "fullName profilePicture role location"
    );

    if (!business) {
      res.status(404).json({ success: false, message: "Business profile not found." });
      return;
    }

    const isOwner = req.user && req.user.id === business.userId._id.toString();
    const isAdmin =
      req.user && (req.user.role === "Admin" || req.user.role === "SuperAdmin");

    // If caller is owner or admin, return full business profile
    if (isOwner || isAdmin) {
      res.status(200).json({
        success: true,
        data: business,
      });
      return;
    }

    // Public view: MUST have Paid subscription
    if (business.subscriptionStatus !== "Paid") {
      res.status(403).json({
        success: false,
        message:
          "This business profile is currently unpaid and pending subscription activation.",
      });
      return;
    }

    // Filter to published brands only for the public
    const businessObj: any = business.toObject();
    businessObj.brands = businessObj.brands.filter((brand: any) => brand.isPublished);

    if (businessObj.brands.length === 0) {
      res.status(404).json({
        success: false,
        message: "No published brands are available for this business.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: businessObj,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 4. Update Brand in Business Profile (PATCH /:id/brands/:brandId) ─────────
export const updateBrand = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const brandId = Array.isArray(req.params.brandId) ? req.params.brandId[0] : req.params.brandId;

    if (!id || !brandId || !mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(brandId)) {
      res.status(400).json({ success: false, message: "Invalid ID format." });
      return;
    }

    const validationResult = updateBrandSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const business = await Business.findById(id);
    if (!business) {
      res.status(404).json({ success: false, message: "Business profile not found." });
      return;
    }

    const isOwner = req.user && req.user.id === business.userId.toString();
    const isAdmin =
      req.user && (req.user.role === "Admin" || req.user.role === "SuperAdmin");

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        message: "Access denied. You can only modify your own business profile.",
      });
      return;
    }

    const brand = business.brands.id(brandId);
    if (!brand) {
      res.status(404).json({ success: false, message: "Brand not found in this business profile." });
      return;
    }

    const data = validationResult.data;
    if (data.brandName !== undefined) brand.brandName = data.brandName;
    if (data.roleInBusiness !== undefined) brand.roleInBusiness = data.roleInBusiness;
    if (data.customRoleTitle !== undefined) brand.customRoleTitle = data.customRoleTitle;
    if (data.contactInfo !== undefined) brand.contactInfo = data.contactInfo as any;
    if (data.businessSummary !== undefined) brand.businessSummary = data.businessSummary;
    if (data.servicesOrProducts !== undefined) brand.servicesOrProducts = data.servicesOrProducts;
    if (data.portfolioOrGallery !== undefined) brand.portfolioOrGallery = data.portfolioOrGallery;
    if (data.websiteLinks !== undefined) brand.websiteLinks = data.websiteLinks;

    await business.save();

    res.status(200).json({
      success: true,
      message: "Brand updated successfully!",
      data: brand,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 5. Delete Brand from Business Profile (DELETE /:id/brands/:brandId) ─────
export const deleteBrand = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const brandId = Array.isArray(req.params.brandId) ? req.params.brandId[0] : req.params.brandId;

    if (!id || !brandId || !mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(brandId)) {
      res.status(400).json({ success: false, message: "Invalid ID format." });
      return;
    }

    const business = await Business.findById(id);
    if (!business) {
      res.status(404).json({ success: false, message: "Business profile not found." });
      return;
    }

    const isOwner = req.user && req.user.id === business.userId.toString();
    const isAdmin =
      req.user && (req.user.role === "Admin" || req.user.role === "SuperAdmin");

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        message: "Access denied. You can only delete your own brands.",
      });
      return;
    }

    const brand = business.brands.id(brandId);
    if (!brand) {
      res.status(404).json({ success: false, message: "Brand not found." });
      return;
    }

    business.brands.pull(brandId);
    await business.save();

    res.status(200).json({
      success: true,
      message: "Brand deleted successfully!",
      data: business,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 6. Track Website Link Click (POST /:id/brands/:brandId/click) ───────────
export const trackWebsiteLinkClick = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const brandId = Array.isArray(req.params.brandId) ? req.params.brandId[0] : req.params.brandId;

    if (!id || !brandId || !mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(brandId)) {
      res.status(400).json({ success: false, message: "Invalid ID format." });
      return;
    }

    const validationResult = clickWebsiteLinkSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { url } = validationResult.data;

    const business = await Business.findById(id);
    if (!business) {
      res.status(404).json({ success: false, message: "Business not found." });
      return;
    }

    const brand = business.brands.id(brandId);
    if (!brand) {
      res.status(404).json({ success: false, message: "Brand not found." });
      return;
    }

    // Check if click tracker already exists for this brand & url
    const objectBrandId = new mongoose.Types.ObjectId(brandId);
    let clickRecord = business.websiteLinkClicks.find(
      (c) => c.brandId?.toString() === brandId && c.url === url
    );

    if (clickRecord) {
      clickRecord.clickCount += 1;
      clickRecord.lastClickedAt = new Date();
    } else {
      business.websiteLinkClicks.push({
        brandId: objectBrandId,
        url,
        clickCount: 1,
        lastClickedAt: new Date(),
      });
      clickRecord = business.websiteLinkClicks[business.websiteLinkClicks.length - 1];
    }

    await business.save();

    res.status(200).json({
      success: true,
      message: "Click tracked successfully.",
      data: {
        brandId,
        url,
        clickCount: clickRecord.clickCount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
