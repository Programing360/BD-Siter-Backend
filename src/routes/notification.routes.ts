import { Router } from "express";
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getAdminNotificationHistory,
  deleteNotificationByAdmin,
} from "../controllers/notification.controller";
import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware";

const router = Router();

// Protect all notification routes
router.use(verifyToken);

// Admin-specific routes
router.get("/admin/history", authorizeRoles("Admin", "SuperAdmin"), getAdminNotificationHistory);
router.delete("/admin/:id", authorizeRoles("Admin", "SuperAdmin"), deleteNotificationByAdmin);

// User notification routes
router.get("/", getMyNotifications);
router.get("/unread-count", getUnreadNotificationCount);
router.patch("/read-all", markAllNotificationsAsRead);
router.post("/read-all", markAllNotificationsAsRead);
router.patch("/mark-all-read", markAllNotificationsAsRead);
router.post("/mark-all-read", markAllNotificationsAsRead);
router.patch("/:id/read", markNotificationAsRead);
router.delete("/:id", deleteNotification);

export default router;
