import { z } from "zod";

export const createProductSchema = z
  .object({
    businessId: z.string().min(1, "Business ID is required"),
    brandName: z.string().min(1, "Brand name is required"),
    title: z.string().min(2, "Product title is required"),
    description: z.string().min(5, "Description is required"),
    category: z
      .preprocess((val) => {
        if (typeof val === "string") {
          const v = val.trim().toLowerCase();
          if (v === "service") return "Service";
        }
        return "Product";
      }, z.enum(["Product", "Service"]))
      .default("Product"),
    subCategory: z.string().trim().optional(),
    mrpPrice: z.number().positive("MRP price must be greater than zero"),
    salePrice: z.number().positive("Sale price must be greater than zero"),
    wholesalePrice: z.number().positive("Wholesale price must be positive").optional(),
    isWholesaleEligible: z.boolean().default(false),
    stock: z.number().int().nonnegative("Stock cannot be negative").default(0),
    images: z.array(z.string().trim()).optional(),
  })
  .refine((data) => data.salePrice <= data.mrpPrice, {
    message: "Sale price must be equal to or less than MRP price.",
    path: ["salePrice"],
  });

export const updateProductSchema = z
  .object({
    brandName: z.string().min(1).optional(),
    title: z.string().min(2).optional(),
    description: z.string().min(5).optional(),
    category: z
      .preprocess((val) => {
        if (typeof val === "string") {
          const v = val.trim().toLowerCase();
          if (v === "service") return "Service";
          if (v === "product") return "Product";
        }
        return val;
      }, z.enum(["Product", "Service"]))
      .optional(),
    subCategory: z.string().trim().optional(),
    mrpPrice: z.number().positive().optional(),
    salePrice: z.number().positive().optional(),
    wholesalePrice: z.number().positive().optional(),
    isWholesaleEligible: z.boolean().optional(),
    stock: z.number().int().nonnegative().optional(),
    images: z.array(z.string().trim()).optional(),
    isAvailable: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.mrpPrice !== undefined && data.salePrice !== undefined) {
        return data.salePrice <= data.mrpPrice;
      }
      return true;
    },
    {
      message: "Sale price must be equal to or less than MRP price.",
      path: ["salePrice"],
    }
  );

export const productQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  search: z.string().optional(),
  category: z.enum(["Product", "Service"]).optional(),
  brand: z.string().optional(),
  sellerId: z.string().optional(),
  isWholesaleEligible: z.coerce.boolean().optional(),
  sortBy: z.enum(["price", "createdAt", "productRating", "title"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const addToCartSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int().positive("Quantity must be at least 1").default(1),
  isWholesale: z.boolean().optional().default(false),
});

export const createOrderSchema = z.object({
  shippingAddress: z.object({
    district: z.string().min(1, "District is required"),
    state: z.string().min(1, "State is required"),
    addressDetails: z.string().min(5, "Address details are required"),
    phone: z.string().min(10, "Valid phone number is required"),
  }),
  orderItems: z
    .array(
      z.object({
        productId: z.string().min(1, "Product ID is required"),
        quantity: z.number().int().positive("Quantity must be at least 1"),
        isWholesale: z.boolean().optional().default(false),
      })
    )
    .optional(), // If not provided, items from user's Cart will be used!
});

export const updateOrderStatusSchema = z.object({
  orderStatus: z.enum(["Pending", "Processing", "Shipped", "Delivered", "Cancelled"]),
});

export const createReviewSchema = z
  .object({
    productRating: z.number().int().min(1).max(5, "Product rating must be 1 to 5"),
    brandRating: z.number().int().min(1).max(5, "Brand rating must be 1 to 5").optional(),
    sellerRating: z.number().int().min(1).max(5, "Seller rating must be 1 to 5").optional(),
    comment: z.string().min(3, "Comment must be at least 3 characters").max(1000),
  })
  .transform((data) => ({
    productRating: data.productRating,
    brandRating: data.brandRating || data.sellerRating || 5,
    comment: data.comment,
  }));
