import { z } from "zod";

export const createResourceSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens")
    .optional(),
  type: z.enum(["Article", "Video", "Downloadable", "Audio", "Worksheet", "Curated"]).optional(),
  format: z.enum(["Downloadable", "Video", "Article", "Worksheet", "Curated"]).optional(),
  category: z.string().min(2, "Category is required").optional().default("General"),
  wing: z.string().optional().default("BDSisters"),
  curatedBySister: z.string().optional(),
  fileSizeOrDuration: z.string().optional(),
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
  type: z.enum(["Article", "Video", "Downloadable", "Audio", "Worksheet", "Curated"]).optional(),
  format: z.enum(["Downloadable", "Video", "Article", "Worksheet", "Curated"]).optional(),
  category: z.string().min(2).optional(),
  wing: z.string().optional(),
  curatedBySister: z.string().optional(),
  fileSizeOrDuration: z.string().optional(),
  description: z.string().min(5).optional(),
  content: z.string().optional(),
  fileUrl: z.string().url().or(z.literal("")).optional(),
  videoUrl: z.string().url().or(z.literal("")).optional(),
  thumbnailUrl: z.string().url().or(z.literal("")).optional(),
  tags: z.array(z.string()).optional(),
  accessLevel: z.enum(["Public", "Member", "PaidMember", "Admin"]).optional(),
  isPublished: z.boolean().optional(),
});
