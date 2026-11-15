import { z } from "zod";

export const brandSchema = z.object({
  brandName: z.string().min(2, "Brand name is required"),
  roleInBusiness: z.string().min(1, "Role in business is required"),
  businessSummary: z
    .string()
    .min(10, "Business summary must be at least 10 characters"),
  servicesOrProducts: z
    .array(z.string())
    .min(1, "At least one service or product is required"),
  websiteLinks: z.array(z.string().url()).optional(),
});

export const createBusinessProfileSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  brands: z.array(brandSchema).min(1, "At least one brand must be added"),
});
