import { Router } from "express";
import {
  getResources,
  getResourceById,
  createResource,
  updateResource,
  deleteResource,
  trackDownload,
} from "../controllers/resource.controller";
import {
  verifyToken,
  optionalAuth,
  authorizeRoles,
} from "../middlewares/auth.middleware";

const router = Router();

// Public & member access
router.get("/", optionalAuth, getResources);
router.get("/:id", optionalAuth, getResourceById);
router.get("/:id/download", trackDownload);
router.post("/:id/download", trackDownload);

// Admin / staff management
router.post(
  "/",
  verifyToken,
  authorizeRoles("Admin", "SuperAdmin"),
  createResource
);
router.patch(
  "/:id",
  verifyToken,
  authorizeRoles("Admin", "SuperAdmin"),
  updateResource
);
router.delete(
  "/:id",
  verifyToken,
  authorizeRoles("Admin", "SuperAdmin"),
  deleteResource
);

export default router;
