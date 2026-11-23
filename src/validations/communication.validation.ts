import { z } from "zod";

export const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("A valid email address is required"),
  phone: z.string().optional(),
  subject: z.string().min(3, "Subject must be at least 3 characters"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

export const updateContactStatusSchema = z.object({
  status: z.enum(["New", "Replied", "Archived"]),
  replyNotes: z.string().optional(),
});

export const newsletterSubscribeSchema = z.object({
  email: z.string().email("A valid email address is required"),
});
