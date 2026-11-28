import { z } from "zod";

export const createEventSchema = z.object({
  title: z.string().min(3, "Event title is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  organizerId: z.string().optional(),
  wing: z.string().optional().default("BDSisters"),
  eventType: z.string().optional().default("Workshop"),
  speaker: z.string().optional().default("BDSisters Mentor"),
  date: z.string().min(1, "Event date is required"),
  time: z.string().min(1, "Event time is required"),
  locationType: z.enum(["Online", "Offline"]).optional().default("Online"),
  locationDetails: z
    .string()
    .min(2, "Location details or meeting link is required"),
  bannerUrl: z.string().url().or(z.literal("")).optional(),
  ticketPrice: z.coerce.number().min(0).optional().default(0),
  isFree: z.boolean().optional(),
  maxAttendees: z.coerce.number().int().min(1).optional(),
  recordingUrl: z.string().url().or(z.literal("")).optional(),
  slidesUrl: z.string().url().or(z.literal("")).optional(),
  summaryNotes: z.string().optional(),
});

export const updateEventSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  wing: z.string().optional(),
  eventType: z.string().optional(),
  speaker: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  locationType: z.enum(["Online", "Offline"]).optional(),
  locationDetails: z.string().optional(),
  bannerUrl: z.string().url().or(z.literal("")).optional(),
  ticketPrice: z.coerce.number().min(0).optional(),
  isFree: z.boolean().optional(),
  maxAttendees: z.coerce.number().int().min(1).optional(),
  isPast: z.boolean().optional(),
  isCancelled: z.boolean().optional(),
  recordingUrl: z.string().url().or(z.literal("")).optional(),
  slidesUrl: z.string().url().or(z.literal("")).optional(),
  summaryNotes: z.string().optional(),
});

export const eventRegistrationSchema = z.object({
  userId: z.string().optional(),
});

export const archiveEventSchema = z.object({
  recordingUrl: z.string().url().or(z.literal("")).optional(),
  slidesUrl: z.string().url().or(z.literal("")).optional(),
  summaryNotes: z.string().optional(),
  archiveMedia: z
    .array(
      z.object({
        type: z.enum(["video", "image", "writeup"]),
        url: z.string().url(),
        caption: z.string().optional(),
      })
    )
    .optional(),
  isPast: z.boolean().optional().default(true),
});
