import { z } from "zod";

export const brandSchema = z
  .object({
    _id: z.string().optional(),
    brandName: z.string().min(2, "Brand name is required"),
    roleInBusiness: z.string().min(1, "Role in business is required").default("Founder"),
    customRoleTitle: z.string().optional(),
    category: z.string().optional(),
    websiteUrl: z.string().optional(),
    contactInfo: z
      .object({
        phone: z.string().optional(),
        email: z.string().email("Invalid email format").optional(),
        address: z.string().optional(),
      })
      .optional(),
    businessSummary: z
      .string()
      .max(500, "Business summary cannot exceed 500 characters")
      .optional(),
    servicesOrProducts: z.array(z.string()).optional(),
    portfolioOrGallery: z.array(z.string().url()).optional(),
    websiteLinks: z.array(z.string()).optional(),
  })
  .transform((data) => {
    const summary =
      data.businessSummary && data.businessSummary.trim().length >= 5
        ? data.businessSummary
        : `${data.brandName} - BDSisters registered brand`;
    const services =
      data.servicesOrProducts && data.servicesOrProducts.length > 0
        ? data.servicesOrProducts
        : [data.category || "General Services"];
    const links = data.websiteLinks || [];
    if (data.websiteUrl && !links.includes(data.websiteUrl)) {
      links.push(data.websiteUrl);
    }
    return {
      ...data,
      businessSummary: summary,
      servicesOrProducts: services,
      websiteLinks: links,
    };
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
    category: z.string().optional(),
    websiteUrl: z.string().optional(),
    contactInfo: z
      .object({
        phone: z.string().optional(),
        email: z.string().email().optional(),
        address: z.string().optional(),
      })
      .optional(),
    businessSummary: z
      .string()
      .max(500)
      .optional(),
    servicesOrProducts: z.array(z.string()).optional(),
    portfolioOrGallery: z.array(z.string().url()).optional(),
    websiteLinks: z.array(z.string()).optional(),
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
  businessSummary: z.string().optional(),
  brands: z.array(brandSchema).min(1, "At least one brand must be added"),
});

export const clickWebsiteLinkSchema = z.object({
  url: z.string().url("A valid URL is required").optional(),
});
