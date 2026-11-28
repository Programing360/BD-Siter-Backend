import { Router } from "express";
import {
  getReviews,
  createReview,
  updateReviewStatus,
} from "../controllers/review.controller";
import { verifyToken, optionalAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", optionalAuth, getReviews);
router.post("/", verifyToken, createReview);
router.patch("/:id", verifyToken, updateReviewStatus);

export default router;
