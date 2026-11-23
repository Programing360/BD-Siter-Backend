import { Router } from "express";
import {
  getNavigationMenu,
  getPublishedPages,
  getPageBySlug,
  getAllPagesForAdmin,
  createPage,
  getPageByIdForAdmin,
  updatePage,
  deletePage,
  addContentBlock,
  updateContentBlock,
  deleteContentBlock,
  reorderContentBlocks,
  getMasterLookups,
} from "../controllers/cms.controller";
import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware";

const router = Router();

// ─── Public Routes (Dynamic frontend pages & navigation) ──────
router.get("/navigation", getNavigationMenu);
router.get("/pages", getPublishedPages);
router.get("/pages/:slug", getPageBySlug);
router.get("/lookups", getMasterLookups);

// ─── Admin Management Routes ──────────────────────────────────
router.use("/admin", verifyToken, authorizeRoles("Admin", "SuperAdmin"));

router.get("/admin/pages", getAllPagesForAdmin);
router.post("/admin/pages", createPage);
router.get("/admin/pages/:id", getPageByIdForAdmin);
router.patch("/admin/pages/:id", updatePage);
router.delete("/admin/pages/:id", deletePage);


// Block management
router.post("/admin/pages/:id/blocks", addContentBlock);
router.patch("/admin/pages/:id/blocks/:blockId", updateContentBlock);
router.delete("/admin/pages/:id/blocks/:blockId", deleteContentBlock);
router.patch("/admin/pages/:id/reorder-blocks", reorderContentBlocks);

export default router;
