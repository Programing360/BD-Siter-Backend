import { z } from "zod";

export const createPostSchema = z.object({
  authorId: z.string().min(1, "Author ID is required"),
  wingName: z.string().min(1, "Wing name is required"),
  content: z
    .string()
    .min(2, "Post content cannot be empty")
    .max(2000, "Content is too long"),
  mediaUrls: z.array(z.string().url()).optional(),
});

export const addCommentSchema = z.object({
  commenterId: z.string().min(1, "Commenter ID is required"),
  comment: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(500, "Comment is too long"),
});
