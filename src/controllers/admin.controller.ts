import { Request, Response } from "express";
import crypto from "crypto";
import { User } from "../models/User.model";
import { Business } from "../models/Business.model";
import { Order } from "../models/Order.model";
import { Payment } from "../models/Payment.model";
import { AuditLog, logAdminAction } from "../models/AuditLog.model";
import { AdminTask } from "../models/AdminTask.model";
import { ApiKey } from "../models/ApiKey.model";
import {
  updateApprovalStatusSchema,
  updateSubscriptionStatusSchema,
  updateUserRoleSchema,
  createAdminTaskSchema,
  updateAdminTaskSchema,
} from "../validations/admin.validation";
import { emailTemplates } from "../utils/sendEmail";
import { createNotification } from "../utils/notification.service";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// Helper for Express 5 parameters
const getParam = (param: unknown): string => {
  if (Array.isArray(param)) return String(param[0]);
  return typeof param === "string" ? param : "";
};

// ─── 1. Get All Pending Users for Approval ────────────────────────────────────
export const getPendingUsers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const pendingUsers = await User.find({
      $or: [{ status: "Pending" }, { profileStatus: "PendingReview" }],
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: pendingUsers.length,
      data: pendingUsers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 2. Get Single User for Admin (includes NID/Passport & logs audit access) ─
export const getUserByIdForAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = getParam(req.params.userId);

    console.log(userId)

    const user = await User.findById(userId).select(
      "+identityVerification.nidOrPassportUrl",
    );

    if (!user) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    if (req.user) {
      if (!user.identityVerification.auditLog) {
        user.identityVerification.auditLog = [];
      }
      user.identityVerification.auditLog.push({
        action: "VIEWED_DOCUMENT",
        adminId: req.user.id as any,
        timestamp: new Date(),
        notes: `Admin (${req.user.id}) viewed sensitive verification document`,
      });
      await user.save();

      // Log central audit trail
      await logAdminAction({
        adminId: req.user.id,
        action: "VIEW_VERIFICATION_DOCUMENT",
        targetModel: "User",
        targetId: userId,
        details: { userFullName: user.fullName },
        ipAddress: req.ip,
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 3. Update User Approval Status (Active / Rejected / Suspended) ───────────
export const updateUserStatus = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = getParam(req.params.userId);
    const validationResult = updateApprovalStatusSchema.safeParse(req.body);

    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { status } = validationResult.data;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    user.status = status;
    if (status === "Active") {
      user.profileStatus = "Active";
      user.identityVerification.verificationStatus = "Approved";
    } else if (status === "Rejected") {
      user.profileStatus = "Rejected";
      user.identityVerification.verificationStatus = "Rejected";
    } else if (status === "Suspended") {
      user.profileStatus = "Suspended";
    }

    if (req.user) {
      if (!user.identityVerification.auditLog) {
        user.identityVerification.auditLog = [];
      }
      user.identityVerification.auditLog.push({
        action: `STATUS_CHANGED_TO_${status.toUpperCase()}`,
        adminId: req.user.id as any,
        timestamp: new Date(),
        notes: `Status changed to ${status}`,
      });

      await logAdminAction({
        adminId: req.user.id,
        action: `USER_STATUS_${status.toUpperCase()}`,
        targetModel: "User",
        targetId: userId,
        details: { newStatus: status, previousStatus: user.status },
        ipAddress: req.ip,
      });
    }

    await user.save();

    // Trigger Notification & Resend Email
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    if (status === "Active") {
      const template = emailTemplates.accountApproved(
        user.fullName,
        `${frontendUrl}/login`,
      );
      await createNotification({
        recipientId: user._id as any,
        senderId: req.user?.id,
        type: "Profile",
        title: "Account & Profile Approved! 🎉",
        message:
          "Your profile has been reviewed and approved by the BDSisters admin team. You can now access all member features.",
        link: `${frontendUrl}/profile`,
        sendEmailNotification: true,
        emailSubject: template.subject,
        emailHtml: template.html,
      });
    } else if (status === "Rejected") {
      await createNotification({
        recipientId: user._id as any,
        senderId: req.user?.id,
        type: "Profile",
        title: "Profile Review Update",
        message:
          "Your profile verification was not approved. Please review your details and resubmit verification if required.",
        link: `${frontendUrl}/profile`,
        sendEmailNotification: true,
        emailSubject: "BDSisters.org Profile Review Update",
      });
    }

    res.status(200).json({
      success: true,
      message: `User status updated to ${status} successfully!`,
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 4. Update User Role (Admin / SuperAdmin / PaidMember / Member) ────────────
export const updateUserRole = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = getParam(req.params.userId);
    const validationResult = updateUserRoleSchema.safeParse(req.body);

    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { role } = validationResult.data;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    if (req.user) {
      await logAdminAction({
        adminId: req.user.id,
        action: "UPDATE_USER_ROLE",
        targetModel: "User",
        targetId: userId,
        details: { oldRole, newRole: role, userEmail: user.email },
        ipAddress: req.ip,
      });
    }

    // In-app notification to the user
    await createNotification({
      recipientId: user._id as any,
      senderId: req.user?.id,
      type: "System",
      title: "Role Updated",
      message: `Your membership role on BDSisters.org has been updated to ${role}.`,
    });

    res.status(200).json({
      success: true,
      message: `User role updated to ${role} successfully.`,
      data: { id: user._id, fullName: user.fullName, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 5. Get All Businesses for Admin ──────────────────────────────────────────
export const getAllBusinessesForAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const businesses = await Business.find().populate(
      "userId",
      "fullName email status",
    );

    res.status(200).json({
      success: true,
      count: businesses.length,
      data: businesses,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 6. Update Business Subscription Status ───────────────────────────────────
export const updateBusinessSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const businessId = getParam(req.params.businessId);
    const validationResult = updateSubscriptionStatusSchema.safeParse(req.body);

    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { subscriptionStatus } = validationResult.data;

    const business = await Business.findById(businessId);
    if (!business) {
      res
        .status(404)
        .json({ success: false, message: "Business profile not found." });
      return;
    }

    const previousStatus = business.subscriptionStatus;
    business.subscriptionStatus = subscriptionStatus;

    // If subscription is Paid, automatically publish all brands
    business.brands.forEach((brand) => {
      brand.isPublished = subscriptionStatus === "Paid";
    });

    if (subscriptionStatus === "Paid") {
      business.subscriptionHistory.push({
        status: "Paid (Admin Granted)",
        paidAt: new Date(),
        amount: 0,
        transactionId: `ADMIN_GRANT_${Date.now()}`,
      });
    }

    await business.save();

    if (req.user) {
      await logAdminAction({
        adminId: req.user.id,
        action: "UPDATE_BUSINESS_SUBSCRIPTION",
        targetModel: "Business",
        targetId: businessId,
        details: { previousStatus, newStatus: subscriptionStatus },
        ipAddress: req.ip,
      });
    }

    // Notify Business Owner
    await createNotification({
      recipientId: business.userId,
      senderId: req.user?.id,
      type: "Business",
      title: "Business Subscription Updated",
      message: `Your business subscription status has been changed to ${subscriptionStatus}.`,
      sendEmailNotification: true,
    });

    res.status(200).json({
      success: true,
      message: `Business subscription updated to ${subscriptionStatus} successfully!`,
      data: business,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 7. Admin Platform Analytics (Production Ready) ───────────────────────────
export const getAdminAnalytics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const timeframe = (req.query.timeframe as string) || "30d";
    const now = new Date();
    let startDate: Date | null = null;

    if (timeframe === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timeframe === "7d") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe === "30d") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeframe === "90d") {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (timeframe === "year") {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    const dateFilter = startDate ? { createdAt: { $gte: startDate } } : {};

    const [
      totalMembers,
      newMembersInPeriod,
      paidMembersCount,
      pendingApprovalsCount,
      totalBusinesses,
      activePaidBusinesses,
      totalOrders,
      orderStatusCounts,
      paymentsSummary,
      commissionStats,
      pendingUsersList,
      recentOrdersList,
      recentAuditLogs,
      monthlyGrowthRaw,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments(dateFilter),
      User.countDocuments({ role: "PaidMember" }),
      User.countDocuments({
        $or: [{ status: "Pending" }, { profileStatus: "PendingReview" }],
      }),
      Business.countDocuments(),
      Business.countDocuments({ subscriptionStatus: "Paid" }),
      Order.countDocuments(dateFilter),
      Order.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: "$status",
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: "Paid", ...dateFilter } },
        {
          $group: {
            _id: null,
            totalCommission: { $sum: "$platformCommission" },
            totalSales: { $sum: "$totalAmount" },
          },
        },
      ]),
      User.find({
        $or: [{ status: "Pending" }, { profileStatus: "PendingReview" }],
      })
        .select(
          "fullName email status profileStatus identityVerification createdAt",
        )
        .sort({ createdAt: -1 })
        .limit(5),
      Order.find()
        .populate("buyerId", "fullName email")
        .select("orderNumber totalAmount orderStatus paymentStatus createdAt")
        .sort({ createdAt: -1 })
        .limit(5),
      AuditLog.find()
        .populate("adminId", "fullName role")
        .sort({ createdAt: -1 })
        .limit(6),
      User.aggregate([
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            registrations: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        { $limit: 6 },
      ]),
    ]);

    const successfulPayments = paymentsSummary.find((p) => p._id === "Success");
    const totalRevenue = successfulPayments
      ? successfulPayments.totalAmount
      : 0;
    const platformCommissionEarned =
      commissionStats.length > 0 ? commissionStats[0].totalCommission : 0;
    const totalOrderSales =
      commissionStats.length > 0 ? commissionStats[0].totalSales : 0;

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const growthSeries = monthlyGrowthRaw.map((item) => ({
      period: `${monthNames[(item._id.month || 1) - 1]} ${item._id.year}`,
      registrations: item.registrations,
    }));

    res.status(200).json({
      success: true,
      data: {
        kpis: {
          totalMembers,
          newMembersInPeriod,
          paidMembers: paidMembersCount,
          freeMembers: Math.max(0, totalMembers - paidMembersCount),
          pendingApprovals: pendingApprovalsCount,
          totalBusinesses,
          activePaidBusinesses,
          totalOrders,
          totalOrderSales,
          totalRevenue,
          platformCommissionEarned,
        },
        ordersByStatus: orderStatusCounts.reduce(
          (acc, curr) => {
            acc[curr._id || "Unknown"] = curr.count;
            return acc;
          },
          {} as Record<string, number>,
        ),
        growthSeries,
        queues: {
          pendingUsers: pendingUsersList,
          recentOrders: recentOrdersList,
          recentActivities: recentAuditLogs,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 8. Get Paginated Audit Logs ──────────────────────────────────────────────
export const getAuditLogs = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.targetModel) filter.targetModel = req.query.targetModel;
    if (req.query.adminId) filter.adminId = req.query.adminId;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("adminId", "fullName email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: logs,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 9. Get Paginated Payments for Admin ───────────────────────────────────────
export const getAdminPayments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (req.query.paymentType) filter.paymentType = req.query.paymentType;
    if (req.query.status) filter.status = req.query.status;

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate("userId", "fullName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: payments,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 10. Admin Task Management (CRUD) ─────────────────────────────────────────

export const getAdminTasks = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;

    const [tasks, total] = await Promise.all([
      AdminTask.find(filter)
        .populate("assignedTo", "fullName email role")
        .populate("assignedBy", "fullName email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AdminTask.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: tasks,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const createAdminTask = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const validationResult = createAdminTaskSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { title, description, assignedTo, priority, dueDate, notes } =
      validationResult.data;

    const assignee = await User.findById(assignedTo);
    if (!assignee) {
      res
        .status(404)
        .json({ success: false, message: "Assignee user not found." });
      return;
    }

    const task = await AdminTask.create({
      title,
      description,
      assignedTo,
      assignedBy: req.user.id,
      priority,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes,
    });

    await logAdminAction({
      adminId: req.user.id,
      action: "CREATE_ADMIN_TASK",
      targetModel: "AdminTask",
      targetId: task._id as any,
      details: { title, assignedTo: assignee.fullName },
      ipAddress: req.ip,
    });

    // Notify assigned admin
    await createNotification({
      recipientId: assignee._id as any,
      senderId: req.user.id,
      type: "System",
      title: "New Task Assigned",
      message: `You have been assigned task: "${title}". Priority: ${priority}.`,
      sendEmailNotification: true,
    });

    res.status(201).json({
      success: true,
      message: "Admin task created successfully.",
      data: task,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getAdminTaskById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const taskId = getParam(req.params.id);
    const task = await AdminTask.findById(taskId)
      .populate("assignedTo", "fullName email role")
      .populate("assignedBy", "fullName email role");

    if (!task) {
      res.status(404).json({ success: false, message: "Task not found." });
      return;
    }

    res.status(200).json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const updateAdminTask = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const taskId = getParam(req.params.id);
    const validationResult = updateAdminTaskSchema.safeParse(req.body);

    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const task = await AdminTask.findById(taskId);
    if (!task) {
      res.status(404).json({ success: false, message: "Task not found." });
      return;
    }

    const data = validationResult.data;
    if (data.title) task.title = data.title;
    if (data.description) task.description = data.description;
    if (data.assignedTo) task.assignedTo = data.assignedTo as any;
    if (data.priority) task.priority = data.priority;
    if (data.notes !== undefined) task.notes = data.notes;
    if (data.dueDate) task.dueDate = new Date(data.dueDate);

    if (data.status) {
      task.status = data.status;
      if (data.status === "Completed") {
        task.completedAt = new Date();
      } else {
        task.completedAt = undefined;
      }
    }

    await task.save();

    if (req.user) {
      await logAdminAction({
        adminId: req.user.id,
        action: "UPDATE_ADMIN_TASK",
        targetModel: "AdminTask",
        targetId: taskId,
        details: { status: task.status, title: task.title },
        ipAddress: req.ip,
      });
    }

    res.status(200).json({
      success: true,
      message: "Admin task updated successfully.",
      data: task,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const deleteAdminTask = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const taskId = getParam(req.params.id);
    const task = await AdminTask.findByIdAndDelete(taskId);

    if (!task) {
      res.status(404).json({ success: false, message: "Task not found." });
      return;
    }

    if (req.user) {
      await logAdminAction({
        adminId: req.user.id,
        action: "DELETE_ADMIN_TASK",
        targetModel: "AdminTask",
        targetId: taskId,
        details: { title: task.title },
        ipAddress: req.ip,
      });
    }

    res.status(200).json({
      success: true,
      message: "Admin task deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 11. Cross-Platform API Key Management ───────────────────────────────────

export const createApiKey = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const {
      name,
      permissions = ["members:read", "wings:read", "events:read"],
    } = req.body;

    if (!name || typeof name !== "string") {
      res
        .status(400)
        .json({
          success: false,
          message: "Partner / application name is required.",
        });
      return;
    }

    // Generate random secret key
    const rawSecret = `bds_live_${crypto.randomBytes(24).toString("hex")}`;
    const prefix = rawSecret.slice(0, 12);
    const keyHash = crypto.createHash("sha256").update(rawSecret).digest("hex");

    const apiKey = await ApiKey.create({
      name,
      keyHash,
      prefix,
      permissions,
      createdBy: req.user.id,
    });

    await logAdminAction({
      adminId: req.user.id,
      action: "CREATE_API_KEY",
      targetModel: "ApiKey",
      targetId: apiKey._id as any,
      details: { name, prefix },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message:
        "API Key created successfully. Copy and store this secret securely; it will not be displayed again.",
      data: {
        id: apiKey._id,
        name: apiKey.name,
        prefix: apiKey.prefix,
        apiKey: rawSecret, // Only returned once at creation!
        permissions: apiKey.permissions,
        createdAt: apiKey.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getApiKeys = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const keys = await ApiKey.find()
      .select("-keyHash")
      .populate("createdBy", "fullName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: keys.length,
      data: keys,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const revokeApiKey = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const key = await ApiKey.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    ).select("-keyHash");

    if (!key) {
      res.status(404).json({ success: false, message: "API key not found." });
      return;
    }

    if (req.user) {
      await logAdminAction({
        adminId: req.user.id,
        action: "REVOKE_API_KEY",
        targetModel: "ApiKey",
        targetId: id,
        details: { name: key.name, prefix: key.prefix },
        ipAddress: req.ip,
      });
    }

    res.status(200).json({
      success: true,
      message: "API Key has been revoked successfully.",
      data: key,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
