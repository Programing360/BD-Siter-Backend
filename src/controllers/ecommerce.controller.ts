import { Request, Response } from "express";
import { Product } from "../models/Product.model";
import { Order } from "../models/Order.model";
import {
  createProductSchema,
  createOrderSchema,
} from "../validations/ecommerce.validation";

// Add New Product
export const addProduct = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const validationResult = createProductSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const product = new Product(validationResult.data);
    await product.save();

    res.status(201).json({
      success: true,
      message: "Product added successfully!",
      data: product,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// Get All Products
export const getProducts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const products = await Product.find({ isAvailable: true });
    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// Create Order
export const createOrder = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const validationResult = createOrderSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { buyerId, orderItems, shippingAddress } = validationResult.data;

    // Calculate total amount
    let totalAmount = 0;
    for (const item of orderItems) {
      totalAmount += item.price * item.quantity;
    }

    const order = new Order({
      buyerId,
      orderItems,
      totalAmount,
      shippingAddress,
      paymentStatus: "Pending",
      orderStatus: "Pending",
    });

    await order.save();

    res.status(201).json({
      success: true,
      message: "Order placed successfully!",
      data: order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
