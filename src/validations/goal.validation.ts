import { z } from "zod";

export const createGoalSchema = z.object({
  title: z.string().min(2, "Title is required"),
  category: z
    .enum(["Spiritual", "Career", "Health", "Family", "Skill", "Other"])
    .optional()
    .default("Other"),
  targetDate: z.string().datetime().optional(),
  progress: z.number().min(0).max(100).optional().default(0),
  status: z
    .enum(["NotStarted", "InProgress", "Completed", "OnHold"])
    .optional()
    .default("NotStarted"),
  milestones: z
    .array(
      z.object({
        title: z.string().min(1),
        isCompleted: z.boolean().optional().default(false),
      })
    )
    .optional()
    .default([]),
  notes: z.string().optional(),
  isPrivate: z.boolean().optional().default(true),
});

export const updateGoalSchema = z.object({
  title: z.string().min(2).optional(),
  category: z
    .enum(["Spiritual", "Career", "Health", "Family", "Skill", "Other"])
    .optional(),
  targetDate: z.string().datetime().optional(),
  progress: z.number().min(0).max(100).optional(),
  status: z
    .enum(["NotStarted", "InProgress", "Completed", "OnHold"])
    .optional(),
  milestones: z
    .array(
      z.object({
        _id: z.string().optional(),
        title: z.string().min(1),
        isCompleted: z.boolean(),
        completedAt: z.string().datetime().optional(),
      })
    )
    .optional(),
  notes: z.string().optional(),
  isPrivate: z.boolean().optional(),
});
