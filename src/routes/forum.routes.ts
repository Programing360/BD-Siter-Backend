import { Router } from "express";
import {
  createPost,
  getPosts,
  getPostById,
  addComment,
  toggleLikePost,
  reportPost,
  deletePost,
  getForumCategories,
  createForumCategory,
  updateForumCategory,
  deleteForumCategory,
  getPostComments,
  moderatePost,
} from "../controllers/forum.controller";
import {
  verifyToken,
  optionalAuth,
  authorizeRoles,
} from "../middlewares/auth.middleware";

const router = Router();

// Public / Tiered post viewing (Guest gets teaser, Members get full)
router.get("/categories", getForumCategories);
router.get("/posts", optionalAuth, getPosts);
router.get("/posts/:id", optionalAuth, getPostById);
router.get("/posts/:id/comments", optionalAuth, getPostComments);

// Category Management (Admin / SuperAdmin)
router.post(
  "/categories",
  verifyToken,
  authorizeRoles("Admin", "SuperAdmin"),
  createForumCategory
);
router.patch(
  "/categories/:id",
  verifyToken,
  authorizeRoles("Admin", "SuperAdmin"),
  updateForumCategory
);
router.delete(
  "/categories/:id",
  verifyToken,
  authorizeRoles("Admin", "SuperAdmin"),
  deleteForumCategory
);

// Post creation & commenting (Member, PaidMember, Admin, SuperAdmin)
router.post(
  "/posts/create",
  verifyToken,
  authorizeRoles("Member", "PaidMember", "Admin", "SuperAdmin"),
  createPost
);
router.post(
  "/posts/:id/comment",
  verifyToken,
  authorizeRoles("Member", "PaidMember", "Admin", "SuperAdmin"),
  addComment
);

// Interactions (Any authenticated member)
router.post("/posts/:id/like", verifyToken, toggleLikePost);
router.post("/posts/:id/report", verifyToken, reportPost);

// Moderation / Author deletion
router.patch(
  "/posts/:id/moderate",
  verifyToken,
  authorizeRoles("Admin", "SuperAdmin"),
  moderatePost
);
router.patch(
  "/posts/:id",
  verifyToken,
  authorizeRoles("Admin", "SuperAdmin"),
  moderatePost
);
router.delete("/posts/:id", verifyToken, deletePost);

export default router;
