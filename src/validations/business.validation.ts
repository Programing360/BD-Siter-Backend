import { z } from "zod";

export const brandSchema = z
  .object({
    brandName: z.string().min(2, "Brand name is required"),
    roleInBusiness: z.string().min(1, "Role in business is required"),
    customRoleTitle: z.string().optional(),
    contactInfo: z
      .object({
        phone: z.string().optional(),
        email: z.string().email("Invalid email format").optional(),
        address: z.string().optional(),
      })
      .optional(),
    businessSummary: z
      .string()
      .min(10, "Business summary must be at least 10 characters")
      .max(500, "Business summary cannot exceed 500 characters"),
    servicesOrProducts: z
      .array(z.string())
      .min(1, "At least one service or product is required"),
    portfolioOrGallery: z.array(z.string().url()).optional(),
    websiteLinks: z.array(z.string().url()).optional(),
  })
  .refine(
    (data) => {
      if (data.roleInBusiness === "Other") {
        return !!data.customRoleTitle && data.customRoleTitle.trim().length > 0;
      }
      return true;
    },
    {
      message: "Custom role title is required when role in business is Other",
      path: ["customRoleTitle"],
    }
  );

export const updateBrandSchema = z
  .object({
    brandName: z.string().min(2, "Brand name must be at least 2 characters").optional(),
    roleInBusiness: z.string().min(1).optional(),
    customRoleTitle: z.string().optional(),
    contactInfo: z
      .object({
        phone: z.string().optional(),
        email: z.string().email().optional(),
        address: z.string().optional(),
      })
      .optional(),
    businessSummary: z
      .string()
      .min(10)
      .max(500)
      .optional(),
    servicesOrProducts: z.array(z.string()).min(1).optional(),
    portfolioOrGallery: z.array(z.string().url()).optional(),
    websiteLinks: z.array(z.string().url()).optional(),
  })
  .refine(
    (data) => {
      if (data.roleInBusiness === "Other") {
        return !!data.customRoleTitle && data.customRoleTitle.trim().length > 0;
      }
      return true;
    },
    {
      message: "Custom role title is required when role in business is Other",
      path: ["customRoleTitle"],
    }
  );

export const createBusinessProfileSchema = z.object({
  userId: z.string().optional(), // Can be inferred from authenticated user
  brands: z.array(brandSchema).min(1, "At least one brand must be added"),
});

export const clickWebsiteLinkSchema = z.object({
  url: z.string().url("A valid URL is required"),
});
