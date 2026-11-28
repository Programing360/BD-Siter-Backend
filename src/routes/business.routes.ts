import { Router } from "express";
import {
  getPublicBusinesses,
  createOrUpdateBusiness,
  getMyBusiness,
  getBusinessById,
  getBrandBySlugOrId,
  updateBrand,
  deleteBrand,
  trackWebsiteLinkClick,
} from "../controllers/business.controller";
import { verifyToken, optionalAuth } from "../middlewares/auth.middleware";

const router = Router();

// Public Business Directory (GET /api/business or /api/businesses)
router.get("/", getPublicBusinesses);

// My Business (must be above /:id to prevent route collision)
router.get("/my", verifyToken, getMyBusiness);

// Create or Add brands
router.post("/create", verifyToken, createOrUpdateBusiness);

// Brand detail by slug or brand ID (public)
router.get("/brands/:slugOrId", getBrandBySlugOrId);

// Affiliate / Website link click tracker by brandId
router.post("/brands/:brandId/click", trackWebsiteLinkClick);

// Public / Member view (optionalAuth checks if viewer is owner/admin or public)
router.get("/:id", optionalAuth, getBusinessById);

// Modify individual brand (owner/admin only)
router.patch("/:id/brands/:brandId", verifyToken, updateBrand);
router.delete("/:id/brands/:brandId", verifyToken, deleteBrand);

// Affiliate / Website link click tracker
router.post("/:id/click", trackWebsiteLinkClick);
router.post("/:id/brands/:brandId/click", trackWebsiteLinkClick);

export default router;
