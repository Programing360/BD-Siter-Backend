import { z } from "zod";
import { WING_NAMES } from "../models/Post.model";

export const wingNameEnum = z.enum(WING_NAMES);

export const categoryToWingMap: Record<string, (typeof WING_NAMES)[number]> = {
  "faith & personal growth": "FaithAndGrowth",
  "faithandgrowth": "FaithAndGrowth",
  "family & parenting": "FamilyAndParenting",
  "familyandparenting": "FamilyAndParenting",
  "sisters in business": "SistersInBusiness",
  "sistersinbusiness": "SistersInBusiness",
  "health & wellness": "HealthAndWellness",
  "healthandwellness": "HealthAndWellness",
  "skills exchange": "SkillsExchange",
  "skills exchange (ask & offer)": "SkillsExchange",
  "skillsexchange": "SkillsExchange",
  "project tasks": "ProjectTasks",
  "projecttasks": "ProjectTasks",
  "general": "General",
};

export const createPostSchema = z
  .object({
    wingName: z.string().optional(),
    category: z.string().optional(),
    title: z.string().optional(),
    content: z
      .string()
      .min(2, "Post content cannot be empty")
      .max(2000, "Content cannot exceed 2000 characters"),
    mediaUrls: z.array(z.string().url("Invalid media URL format")).optional(),
    tags: z.array(z.string()).optional(),
    authorId: z.string().optional(),
    isAnonymous: z.boolean().optional(),
  })
  .transform((data) => {
    let wing: (typeof WING_NAMES)[number] = "General";
    if (data.wingName && (WING_NAMES as readonly string[]).includes(data.wingName)) {
      wing = data.wingName as (typeof WING_NAMES)[number];
    } else if (data.category) {
      const normalizedCat = data.category.toLowerCase().trim();
      if (categoryToWingMap[normalizedCat]) {
        wing = categoryToWingMap[normalizedCat];
      }
    }
    return {
      ...data,
      wingName: wing,
    };
  });

export const addCommentSchema = z
  .object({
    comment: z.string().optional(),
    content: z.string().optional(),
    commenterId: z.string().optional(),
  })
  .refine((data) => !!(data.comment?.trim() || data.content?.trim()), {
    message: "Comment cannot be empty",
  })
  .transform((data) => ({
    comment: (data.comment?.trim() || data.content?.trim() || "") as string,
    commenterId: data.commenterId,
  }));

export const reportPostSchema = z.object({
  reason: z
    .string()
    .min(3, "Reason must be at least 3 characters")
    .max(300, "Reason cannot exceed 300 characters"),
});

export const forumQuerySchema = z.object({
  wing: z.string().optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  includeHidden: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .optional(),
  filter: z.enum(["all", "reported", "hidden"]).optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters").max(100),
  slug: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().default(""),
  wingName: z.string().optional(),
  order: z.coerce.number().int().default(0),
  icon: z.string().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  wingName: z.string().optional(),
  order: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
  icon: z.string().optional(),
});

