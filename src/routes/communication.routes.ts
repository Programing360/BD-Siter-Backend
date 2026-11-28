import { Router } from "express";
import {
  submitContactForm,
  getContactMessages,
  updateContactMessageStatus,
  subscribeNewsletter,
  unsubscribeNewsletter,
  getNewsletterSubscribers,
} from "../controllers/communication.controller";
import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware";

const router = Router();

// Public routes
router.post("/contact", submitContactForm);
router.post("/newsletter", subscribeNewsletter);
router.post("/newsletter/subscribe", subscribeNewsletter);
router.post("/newsletter/unsubscribe", unsubscribeNewsletter);

// Admin-protected communication routes
router.get(
  "/admin/contact-messages",
  verifyToken,
  authorizeRoles("Admin", "SuperAdmin"),
  getContactMessages
);
router.patch(
  "/admin/contact-messages/:id",
  verifyToken,
  authorizeRoles("Admin", "SuperAdmin"),
  updateContactMessageStatus
);
router.get(
  "/admin/newsletter/subscribers",
  verifyToken,
  authorizeRoles("Admin", "SuperAdmin"),
  getNewsletterSubscribers
);

export default router;
