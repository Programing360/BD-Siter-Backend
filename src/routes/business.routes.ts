import { Router } from "express";
import {
  createOrUpdateBusiness,
  getMyBusiness,
  getBusinessById,
  updateBrand,
  deleteBrand,
  trackWebsiteLinkClick,
} from "../controllers/business.controller";
import { verifyToken, optionalAuth } from "../middlewares/auth.middleware";

const router = Router();

// My Business (must be above /:id to prevent route collision)
router.get("/my", verifyToken, getMyBusiness);

// Create or Add brands
router.post("/create", verifyToken, createOrUpdateBusiness);

// Public / Member view (optionalAuth checks if viewer is owner/admin or public)
router.get("/:id", optionalAuth, getBusinessById);

// Modify individual brand (owner/admin only)
router.patch("/:id/brands/:brandId", verifyToken, updateBrand);
router.delete("/:id/brands/:brandId", verifyToken, deleteBrand);

// Affiliate / Website link click tracker
router.post("/:id/brands/:brandId/click", trackWebsiteLinkClick);

export default router;
