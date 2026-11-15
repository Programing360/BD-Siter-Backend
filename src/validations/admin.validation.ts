import { z } from "zod";

export const updateApprovalStatusSchema = z.object({
  status: z.enum(["Active", "Rejected", "Pending"]),
});

export const updateSubscriptionStatusSchema = z.object({
  subscriptionStatus: z.enum(["Unpaid", "Paid"]),
});
