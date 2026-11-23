import { z } from "zod";

export const createEventSchema = z.object({
  title: z.string().min(3, "Event title is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  organizerId: z.string().optional(),
  date: z.string().min(1, "Event date is required"),
  time: z.string().min(1, "Event time is required"),
  locationType: z.enum(["Online", "Offline"]),
  locationDetails: z
    .string()
    .min(2, "Location details or meeting link is required"),
  bannerUrl: z.string().url().or(z.literal("")).optional(),
  ticketPrice: z.number().min(0).optional().default(0),
  maxAttendees: z.number().int().min(1).optional(),
});

export const eventRegistrationSchema = z.object({
  userId: z.string().optional(),
});

export const archiveEventSchema = z.object({
  archiveMedia: z.array(
    z.object({
      type: z.enum(["video", "image", "writeup"]),
      url: z.string().url(),
      caption: z.string().optional(),
    })
  ),
  isPast: z.boolean().optional().default(true),
});
