import { Router } from "express";
import {
  registerUser,
  loginUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  logoutUser,
  getMe,
  updateMe,
  updateContact,
  submitProfileForReview,
  exportProfilePdf,
  resendVerificationEmail,
} from "../controllers/auth.controller";
import { validateReferral } from "../middlewares/referral.middleware";
import { verifyToken } from "../middlewares/auth.middleware";
import { authLimiter } from "../middlewares/rateLimiter";

const router = Router();

// Public routes (authLimiter applied only on sensitive endpoints)
router.post("/register", authLimiter, validateReferral, registerUser);
router.post("/login", authLimiter, loginUser);
router.post("/verify-email", authLimiter, verifyEmail);
router.post("/resend-verification", authLimiter, resendVerificationEmail);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);
router.post("/logout", logoutUser);

// Protected routes (covered by generalLimiter: 300 req / 15 min)
router.get("/me", verifyToken, getMe);
router.patch("/me", verifyToken, updateMe);
router.patch("/me/contact", verifyToken, updateContact);
router.post("/me/submit-review", verifyToken, submitProfileForReview);
router.get("/me/export-pdf", verifyToken, exportProfilePdf);

export default router;