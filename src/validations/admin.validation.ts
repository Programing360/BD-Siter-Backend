import { z } from "zod";

export const updateApprovalStatusSchema = z.object({
  status: z.enum(["Active", "Rejected", "Pending", "Suspended"]),
});

export const updateSubscriptionStatusSchema = z.object({
  subscriptionStatus: z.enum(["Unpaid", "Paid"]),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["Guest", "Member", "PaidMember", "Admin", "SuperAdmin"]),
});

export const createAdminTaskSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  assignedTo: z.string().min(1, "AssignedTo userId is required"),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional().default("Medium"),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const updateAdminTaskSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(5).optional(),
  assignedTo: z.string().optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional(),
  status: z.enum(["Pending", "InProgress", "Completed", "Cancelled"]).optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});
