import { z } from "zod";

export const createEventSchema = z.object({
  title: z.string().min(3, "Event title is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  organizerId: z.string().min(1, "Organizer ID is required"),
  date: z.string().min(1, "Event date is required"),
  time: z.string().min(1, "Event time is required"),
  locationType: z.enum(["Online", "Offline"]),
  locationDetails: z
    .string()
    .min(2, "Location details or meeting link is required"),
  bannerUrl: z.string().url().optional(),
});

export const eventRegistrationSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});
