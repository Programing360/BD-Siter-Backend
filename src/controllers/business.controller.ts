import { Request, Response } from "express";
import mongoose from "mongoose";
import { Business } from "../models/Business.model";
import { User } from "../models/User.model";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import {
  createBusinessProfileSchema,
  updateBrandSchema,
  clickWebsiteLinkSchema,
} from "../validations/business.validation";

// ─── 0. Get All Public Businesses (GET / or GET /api/businesses) ──────────────
export const getPublicBusinesses = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { search, category, userId } = req.query;

    // Requirement: return all business profiles where subscriptionStatus === "Paid"
    // OR isPublished === true OR status === "Approved" (or has published brands)
    const queryConditions: any[] = [
      {
        $or: [
          { subscriptionStatus: "Paid" },
          { isPublished: true },
          { status: "Approved" },
          { "brands.isPublished": true },
        ],
      },
    ];

    if (userId && typeof userId === "string" && mongoose.Types.ObjectId.isValid(userId)) {
      queryConditions.push({ userId: new mongoose.Types.ObjectId(userId) });
    }

    if (search && typeof search === "string" && search.trim()) {
      const s = search.trim();
      const regex = new RegExp(s, "i");
      queryConditions.push({
        $or: [
          { "brands.brandName": regex },
          { "brands.businessSummary": regex },
          { "brands.servicesOrProducts": regex },
          { "brands.category": regex },
          { businessSummary: regex },
        ],
      });
    }

    if (category && typeof category === "string" && category.trim()) {
      const c = category.trim();
      const regex = new RegExp(c, "i");
      queryConditions.push({
        $or: [
          { "brands.category": regex },
          { "brands.servicesOrProducts": regex },
        ],
      });
    }

    const filter =
      queryConditions.length > 1 ? { $and: queryConditions } : queryConditions[0];

    const rawBusinesses = await Business.find(filter)
      .populate("userId", "fullName email profilePicture role location status")
      .sort({ updatedAt: -1, createdAt: -1 });

    // Deduplicate profiles (if duplicate seed records exist for the same user or brand fingerprints)
    const seenUserIds = new Set<string>();
    const seenBrandFingerprints = new Set<string>();
    const businesses = [];

    for (const biz of rawBusinesses) {
      const uId = biz.userId
        ? (biz.userId as any)._id?.toString() || (biz.userId as any).toString()
        : null;

      const brandFingerprint = (biz.brands || [])
        .map((b) => (b.brandName || "").trim().toLowerCase())
        .sort()
        .join("|");

      if (uId && seenUserIds.has(uId)) {
        continue;
      }
      if (brandFingerprint && seenBrandFingerprints.has(brandFingerprint)) {
        continue;
      }

      if (uId) seenUserIds.add(uId);
      if (brandFingerprint) seenBrandFingerprints.add(brandFingerprint);

      // Return published brands (or all brands if profile itself is Paid/Approved)
      const isPaidOrApproved =
        biz.subscriptionStatus === "Paid" ||
        (biz as any).status === "Approved" ||
        (biz as any).isPublished === true;

      const bizObj: any = biz.toObject();
      if (!isPaidOrApproved) {
        bizObj.brands = (bizObj.brands || []).filter((b: any) => b.isPublished);
      }

      // Ensure website links, direct URL accessibility, and real affiliate clicks
      if (Array.isArray(bizObj.brands)) {
        bizObj.brands = bizObj.brands.map((b: any) => {
          const brandIdStr = (b._id as any)?.toString();
          const clicksForBrand = (biz.websiteLinkClicks || [])
            .filter((c: any) => c.brandId?.toString() === brandIdStr)
            .reduce((sum: number, c: any) => sum + (c.clickCount || 0), 0);

          return {
            ...b,
            websiteUrl: b.websiteLinks?.[0] || b.websiteUrl || "",
            affiliateClicks: b.affiliateClicks ?? clicksForBrand,
          };
        });
      }

      businesses.push(bizObj);
    }

    res.status(200).json({
      success: true,
      count: businesses.length,
      data: businesses,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

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
      "fullName email profilePicture role location"
    );

    if (!business) {
      res.status(404).json({ success: false, message: "Business profile not found." });
      return;
    }

    const isOwner =
      req.user &&
      business.userId &&
      ((business.userId as any)._id?.toString() === req.user.id ||
        (business.userId as any).toString() === req.user.id);
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

// ─── 6. Track Website Link Click (POST /:id/brands/:brandId/click or POST /brands/:brandId/click) ───────────
export const trackWebsiteLinkClick = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const brandIdParam = Array.isArray(req.params.brandId) ? req.params.brandId[0] : req.params.brandId;
    const brandId = brandIdParam || idParam;

    if (!brandId || !mongoose.Types.ObjectId.isValid(brandId)) {
      res.status(400).json({ success: false, message: "Invalid brand ID format." });
      return;
    }

    const validationResult = clickWebsiteLinkSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    // Locate the business either by business ID or by containing brand ID
    const business =
      idParam && idParam !== brandId && mongoose.Types.ObjectId.isValid(idParam)
        ? await Business.findById(idParam)
        : await Business.findOne({ "brands._id": brandId });

    if (!business) {
      res.status(404).json({ success: false, message: "Business not found." });
      return;
    }

    const brand = business.brands.id(brandId);
    if (!brand) {
      res.status(404).json({ success: false, message: "Brand not found." });
      return;
    }

    const targetUrl =
      validationResult.data?.url ||
      brand.websiteLinks?.[0] ||
      "https://bdsisters.org";

    // Check if click tracker already exists for this brand & url
    const objectBrandId = new mongoose.Types.ObjectId(brandId);
    let clickRecord = business.websiteLinkClicks.find(
      (c) => c.brandId?.toString() === brandId && c.url === targetUrl
    );

    if (clickRecord) {
      clickRecord.clickCount += 1;
      clickRecord.lastClickedAt = new Date();
    } else {
      business.websiteLinkClicks.push({
        brandId: objectBrandId,
        url: targetUrl,
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
        url: targetUrl,
        clickCount: clickRecord.clickCount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 7. Get Public Brand Detail by Slug or ID (GET /brands/:slugOrId) ─────────
export const getBrandBySlugOrId = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const slugOrId = Array.isArray(req.params.slugOrId)
      ? req.params.slugOrId[0]
      : req.params.slugOrId;

    if (!slugOrId) {
      res.status(400).json({ success: false, message: "Brand identifier is required." });
      return;
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(slugOrId);
    let business: any = null;
    let targetBrand: any = null;

    if (isObjectId) {
      business = await Business.findOne({ "brands._id": slugOrId }).populate(
        "userId",
        "fullName email profilePicture role location"
      );
      if (business) {
        targetBrand = business.brands.id(slugOrId);
      }
    }

    if (!targetBrand) {
      // Find by matching slug or name across all businesses
      const allBusinesses = await Business.find().populate(
        "userId",
        "fullName email profilePicture role location"
      );

      const normalizedQuery = slugOrId.toLowerCase().replace(/[^a-z0-9]/g, "");

      for (const biz of allBusinesses) {
        for (const brand of biz.brands) {
          const brandNameNorm = (brand.brandName || "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
          const brandIdStr = (brand._id as any)?.toString() || "";

          if (
            brandNameNorm === normalizedQuery ||
            brandIdStr === slugOrId ||
            (brand.brandName &&
              brand.brandName.toLowerCase() === slugOrId.toLowerCase())
          ) {
            business = biz;
            targetBrand = brand;
            break;
          }
        }
        if (targetBrand) break;
      }
    }

    if (!business || !targetBrand) {
      res.status(404).json({ success: false, message: "Brand not found." });
      return;
    }

    // Calculate link clicks for this brand
    const brandIdStr = (targetBrand._id as any)?.toString();
    const clicksForBrand = (business.websiteLinkClicks || [])
      .filter((c: any) => c.brandId?.toString() === brandIdStr)
      .reduce((sum: number, c: any) => sum + (c.clickCount || 0), 0);

    const founder = business.userId as any;

    const brandData = {
      _id: targetBrand._id,
      brandId: targetBrand._id,
      businessId: business._id,
      brandName: targetBrand.brandName,
      roleInBusiness: targetBrand.roleInBusiness,
      customRoleTitle: targetBrand.customRoleTitle,
      contactInfo: targetBrand.contactInfo || {},
      businessSummary: targetBrand.businessSummary,
      servicesOrProducts: targetBrand.servicesOrProducts || [],
      portfolioOrGallery: targetBrand.portfolioOrGallery || [],
      testimonialsAndReviews: targetBrand.testimonialsAndReviews || [],
      websiteLinks: targetBrand.websiteLinks || [],
      websiteUrl: targetBrand.websiteLinks?.[0] || "",
      isPublished: targetBrand.isPublished,
      affiliateClicks: clicksForBrand,
      founder: {
        _id: founder?._id,
        fullName: founder?.fullName || "Sister Entrepreneur",
        email: founder?.email,
        profilePicture: founder?.profilePicture,
        location: founder?.location,
      },
      subscriptionStatus: business.subscriptionStatus,
      createdAt: targetBrand.createdAt || business.createdAt,
    };

    res.status(200).json({
      success: true,
      data: brandData,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
