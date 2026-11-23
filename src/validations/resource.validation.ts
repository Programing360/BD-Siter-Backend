import { z } from "zod";

export const createResourceSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens"),
  type: z.enum(["Article", "Video", "Downloadable", "Audio"]),
  category: z.string().min(2, "Category is required"),
  description: z.string().min(5, "Description is required"),
  content: z.string().optional(),
  fileUrl: z.string().url().or(z.literal("")).optional(),
  videoUrl: z.string().url().or(z.literal("")).optional(),
  thumbnailUrl: z.string().url().or(z.literal("")).optional(),
  tags: z.array(z.string()).optional().default([]),
  accessLevel: z.enum(["Public", "Member", "PaidMember", "Admin"]).optional().default("Member"),
  isPublished: z.boolean().optional().default(true),
});

export const updateResourceSchema = z.object({
  title: z.string().min(3).optional(),
  type: z.enum(["Article", "Video", "Downloadable", "Audio"]).optional(),
  category: z.string().min(2).optional(),
  description: z.string().min(5).optional(),
  content: z.string().optional(),
  fileUrl: z.string().url().or(z.literal("")).optional(),
  videoUrl: z.string().url().or(z.literal("")).optional(),
  thumbnailUrl: z.string().url().or(z.literal("")).optional(),
  tags: z.array(z.string()).optional(),
  accessLevel: z.enum(["Public", "Member", "PaidMember", "Admin"]).optional(),
  isPublished: z.boolean().optional(),
});
