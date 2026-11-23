import { z } from "zod";

export const createCmsPageSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens"),
  title: z.string().min(2).max(200),
  metaDescription: z.string().max(500).optional(),
  isPublished: z.boolean().optional().default(false),
  showInNav: z.boolean().optional().default(false),
  navLabel: z.string().max(50).optional(),
  navOrder: z.number().int().optional().default(0),
});

export const updateCmsPageSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  metaDescription: z.string().max(500).optional(),
  isPublished: z.boolean().optional(),
  showInNav: z.boolean().optional(),
  navLabel: z.string().max(50).optional(),
  navOrder: z.number().int().optional(),
});

export const createContentBlockSchema = z.object({
  blockId: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Block ID must be alphanumeric and hyphenated"),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  content: z.string().optional().default(""),
  order: z.number().int().optional().default(0),
  isVisible: z.boolean().optional().default(true),
  imageUrl: z.string().url().or(z.literal("")).optional(),
  hoverTooltip: z
    .string()
    .max(1000, "Tooltip explanation max length is 1000 characters")
    .optional()
    .default(""),
  ctaText: z.string().max(100).optional(),
  ctaLink: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const updateContentBlockSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(300).optional(),
  content: z.string().optional(),
  order: z.number().int().optional(),
  isVisible: z.boolean().optional(),
  imageUrl: z.string().url().or(z.literal("")).optional(),
  hoverTooltip: z.string().max(1000).optional(),
  ctaText: z.string().max(100).optional(),
  ctaLink: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const reorderBlocksSchema = z.object({
  blockOrders: z.array(
    z.object({
      blockId: z.string(),
      order: z.number().int(),
    })
  ),
});
