import { z } from "zod";

export const createProductSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  brandName: z.string().min(1, "Brand name is required"),
  title: z.string().min(2, "Product title is required"),
  description: z.string().min(5, "Description is required"),
  price: z.number().positive("Price must be greater than zero"),
  stock: z.number().int().nonnegative("Stock cannot be negative"),
  category: z.string().min(1, "Category is required"),
  images: z.array(z.string().url()).optional(),
});

export const createOrderSchema = z.object({
  buyerId: z.string().min(1, "Buyer ID is required"),
  orderItems: z
    .array(
      z.object({
        productId: z.string().min(1, "Product ID is required"),
        quantity: z.number().int().positive("Quantity must be at least 1"),
        price: z.number().positive("Price is required"),
      }),
    )
    .min(1, "Order must contain at least one item"),
  shippingAddress: z.object({
    district: z.string().min(1, "District is required"),
    state: z.string().min(1, "State is required"),
    addressDetails: z.string().min(5, "Address details are required"),
    phone: z.string().min(10, "Valid phone number is required"),
  }),
});
