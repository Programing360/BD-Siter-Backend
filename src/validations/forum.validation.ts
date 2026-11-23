import { z } from "zod";
import { WING_NAMES } from "../models/Post.model";

export const wingNameEnum = z.enum(WING_NAMES);

export const createPostSchema = z.object({
  wingName: wingNameEnum.default("General"),
  content: z
    .string()
    .min(2, "Post content cannot be empty")
    .max(2000, "Content cannot exceed 2000 characters"),
  mediaUrls: z.array(z.string().url("Invalid media URL format")).optional(),
  authorId: z.string().optional(),
});

export const addCommentSchema = z.object({
  comment: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(500, "Comment cannot exceed 500 characters"),
  commenterId: z.string().optional(),
});

export const reportPostSchema = z.object({
  reason: z
    .string()
    .min(3, "Reason must be at least 3 characters")
    .max(300, "Reason cannot exceed 300 characters"),
});

export const forumQuerySchema = z.object({
  wing: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  search: z.string().optional(),
});
