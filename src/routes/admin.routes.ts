import { Router } from "express";
import {
  getPendingUsers,
  getUserByIdForAdmin,
  updateUserStatus,
  updateUserRole,
  getAllBusinessesForAdmin,
  updateBusinessSubscription,
  getAdminAnalytics,
  getAuditLogs,
  getAdminPayments,
  getAdminTasks,
  createAdminTask,
  getAdminTaskById,
  updateAdminTask,
  deleteAdminTask,
  createApiKey,
  getApiKeys,
  revokeApiKey,
} from "../controllers/admin.controller";
import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware";
import { createMasterLookup, deleteMasterLookup } from "../controllers/cms.controller";

const router = Router();

// Protect ALL admin routes with authentication and role check (Admin or SuperAdmin only)
router.use(verifyToken, authorizeRoles("Admin", "SuperAdmin"));

// ─── Analytics & Financials ──────────────────────────────
router.get("/analytics", getAdminAnalytics);
router.get("/audit-logs", getAuditLogs);
router.get("/payments", getAdminPayments);

// ─── User Management ──────────────────────────────────────
router.get("/users/pending", getPendingUsers);
router.get("/users/:userId", getUserByIdForAdmin);
router.patch("/users/:userId/status", updateUserStatus);
router.patch("/users/:userId/role", updateUserRole);

// ─── Business Management ──────────────────────────────────
router.get("/businesses", getAllBusinessesForAdmin);
router.patch("/businesses/:businessId/subscription", updateBusinessSubscription);

// ─── Task Management ──────────────────────────────────────
router.get("/tasks", getAdminTasks);
router.post("/tasks", createAdminTask);
router.post("/lookups", verifyToken, createMasterLookup);
router.get("/tasks/:id", getAdminTaskById);
router.patch("/tasks/:id", updateAdminTask);
router.delete("/tasks/:id", deleteAdminTask);
router.delete("/lookups/:id", verifyToken, deleteMasterLookup);
// ─── Cross-Platform API Keys ──────────────────────────────
router.post("/api-keys", createApiKey);
router.get("/api-keys", getApiKeys);
router.patch("/api-keys/:id/revoke", revokeApiKey);

export default router;
