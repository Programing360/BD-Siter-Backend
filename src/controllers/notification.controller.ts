import { Response } from "express";
import { Notification } from "../models/Notification.model";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// Helper for Express 5 params
const getParam = (param: unknown): string => {
  if (Array.isArray(param)) return String(param[0]);
  return typeof param === "string" ? param : "";
};

// 1. Get Logged-in User's Notifications
export const getMyNotifications = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { recipientId: req.user.id };
    if (req.query.unreadOnly === "true") {
      filter.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ isRead: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipientId: req.user.id, isRead: false }),
    ]);

    res.status(200).json({
      success: true,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: notifications,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 2. Get Unread Notification Count
export const getUnreadNotificationCount = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const count = await Notification.countDocuments({
      recipientId: req.user.id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 3. Mark Single Notification as Read
export const markNotificationAsRead = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const id = getParam(req.params.id);
    const notification = await Notification.findOne({
      _id: id,
      recipientId: req.user.id,
    });

    if (!notification) {
      res.status(404).json({ success: false, message: "Notification not found." });
      return;
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      data: notification,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 4. Mark All Notifications as Read
export const markAllNotificationsAsRead = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    await Notification.updateMany(
      { recipientId: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 5. Delete Notification
export const deleteNotification = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const id = getParam(req.params.id);
    const deleted = await Notification.findOneAndDelete({
      _id: id,
      recipientId: req.user.id,
    });

    if (!deleted) {
      res.status(404).json({ success: false, message: "Notification not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 6. Get All Notifications / Dispatch History for Admin
export const getAdminNotificationHistory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (req.query.status === "read") {
      filter.isRead = true;
    } else if (req.query.status === "unread") {
      filter.isRead = false;
    }

    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(String(req.query.search).trim(), "i");
      filter.$or = [
        { title: searchRegex },
        { message: searchRegex },
      ];
    }

    const [notifications, total, totalUnread] = await Promise.all([
      Notification.find(filter)
        .populate("recipientId", "name email role")
        .populate("senderId", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ isRead: false }),
    ]);

    res.status(200).json({
      success: true,
      totalUnread,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: notifications,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 7. Delete Notification by Admin (Can delete any notification)
export const deleteNotificationByAdmin = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const id = getParam(req.params.id);
    const deleted = await Notification.findByIdAndDelete(id);

    if (!deleted) {
      res.status(404).json({ success: false, message: "Notification not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Notification removed by admin successfully.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
