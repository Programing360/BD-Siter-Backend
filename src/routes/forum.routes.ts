import { Router } from "express";
import {
  createPost,
  getPosts,
  getPostById,
  addComment,
  toggleLikePost,
  reportPost,
  deletePost,
} from "../controllers/forum.controller";
import {
  verifyToken,
  optionalAuth,
  authorizeRoles,
} from "../middlewares/auth.middleware";

const router = Router();

// Public / Tiered post viewing (Guest gets teaser, Members get full)
router.get("/posts", optionalAuth, getPosts);
router.get("/posts/:id", optionalAuth, getPostById);

// Post creation & commenting (PaidMember / Admin only)
router.post(
  "/posts/create",
  verifyToken,
  authorizeRoles("PaidMember", "Admin", "SuperAdmin"),
  createPost
);
router.post(
  "/posts/:id/comment",
  verifyToken,
  authorizeRoles("PaidMember", "Admin", "SuperAdmin"),
  addComment
);

// Interactions (Any authenticated member)
router.post("/posts/:id/like", verifyToken, toggleLikePost);
router.post("/posts/:id/report", verifyToken, reportPost);

// Moderation / Author deletion
router.delete("/posts/:id", verifyToken, deletePost);

export default router;
