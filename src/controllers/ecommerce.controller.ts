import { Response } from "express";
import mongoose from "mongoose";
import { Product } from "../models/Product.model";
import { Order } from "../models/Order.model";
import { Cart } from "../models/Cart.model";
import { Review } from "../models/Review.model";
import { Business } from "../models/Business.model";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { createNotification } from "../utils/notification.service";
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
  addToCartSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  createReviewSchema,
} from "../validations/ecommerce.validation";

// Helper for Express 5 params
const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0];
  return param || "";
};

// ─── 1. Add New Product (POST /products/add) ──────────────────────────────────
// Protected: Seller / Business Owner
export const addProduct = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const validationResult = createProductSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { businessId, brandName, ...rest } = validationResult.data;

    // Verify business exists and is linked to the authenticated user
    const business = await Business.findById(businessId);
    if (!business) {
      res.status(404).json({ success: false, message: "Business profile not found." });
      return;
    }

    const isOwner = business.userId.toString() === req.user.id;
    const isAdmin = req.user.role === "Admin" || req.user.role === "SuperAdmin";

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        message: "Access denied. You can only add products to your own business.",
      });
      return;
    }

    const product = new Product({
      ...rest,
      businessId: new mongoose.Types.ObjectId(businessId),
      sellerId: new mongoose.Types.ObjectId(req.user.id),
      brandName,
      price: rest.salePrice,
    });

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

// ─── 2. Get All Products (GET /products) ──────────────────────────────────────
// Public: supports category, brand, search, wholesale, sorting & pagination
export const getProducts = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const validationResult = productQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const {
      page,
      limit,
      search,
      category,
      brand,
      sellerId,
      isWholesaleEligible,
      sortBy,
      sortOrder,
    } = validationResult.data;

    const query: any = { isAvailable: true, isDeleted: false };

    if (category) {
      query.category = category;
    }

    if (brand && brand.trim() !== "") {
      query.brandName = { $regex: brand.trim(), $options: "i" };
    }

    if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
      query.sellerId = new mongoose.Types.ObjectId(sellerId);
    }

    if (isWholesaleEligible !== undefined) {
      query.isWholesaleEligible = isWholesaleEligible;
    }

    if (search && search.trim() !== "") {
      query.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
        { brandName: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    const skip = (page - 1) * limit;
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate("sellerId", "fullName profilePicture role")
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: products,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 3. Get Single Product (GET /products/:id) ────────────────────────────────
export const getProductById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid product ID." });
      return;
    }

    const product = await Product.findOne({ _id: id, isDeleted: false })
      .populate("businessId", "brands subscriptionStatus")
      .populate("sellerId", "fullName profilePicture role location");

    if (!product) {
      res.status(404).json({ success: false, message: "Product not found." });
      return;
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 4. Update Product (PATCH /products/:id) ──────────────────────────────────
// Protected: Product Owner / Admin
export const updateProduct = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const id = getParam(req.params.id);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid product ID." });
      return;
    }

    const validationResult = updateProductSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const product = await Product.findOne({ _id: id, isDeleted: false });
    if (!product) {
      res.status(404).json({ success: false, message: "Product not found." });
      return;
    }

    const isOwner = product.sellerId.toString() === req.user.id;
    const isAdmin = req.user.role === "Admin" || req.user.role === "SuperAdmin";

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        message: "Access denied. You can only update your own products.",
      });
      return;
    }

    const data = validationResult.data;
    if (data.brandName !== undefined) product.brandName = data.brandName;
    if (data.title !== undefined) product.title = data.title;
    if (data.description !== undefined) product.description = data.description;
    if (data.category !== undefined) product.category = data.category;
    if (data.mrpPrice !== undefined) product.mrpPrice = data.mrpPrice;
    if (data.salePrice !== undefined) {
      product.salePrice = data.salePrice;
      product.price = data.salePrice;
    }
    if (data.wholesalePrice !== undefined) product.wholesalePrice = data.wholesalePrice;
    if (data.isWholesaleEligible !== undefined) product.isWholesaleEligible = data.isWholesaleEligible;
    if (data.stock !== undefined) product.stock = data.stock;
    if (data.images !== undefined) product.images = data.images;
    if (data.isAvailable !== undefined) product.isAvailable = data.isAvailable;

    await product.save();

    res.status(200).json({
      success: true,
      message: "Product updated successfully!",
      data: product,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 5. Delete Product (DELETE /products/:id) ─────────────────────────────────
// Protected: Product Owner / Admin (Soft Delete)
export const deleteProduct = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const id = getParam(req.params.id);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid product ID." });
      return;
    }

    const product = await Product.findOne({ _id: id, isDeleted: false });
    if (!product) {
      res.status(404).json({ success: false, message: "Product not found." });
      return;
    }

    const isOwner = product.sellerId.toString() === req.user.id;
    const isAdmin = req.user.role === "Admin" || req.user.role === "SuperAdmin";

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        message: "Access denied. You can only delete your own products.",
      });
      return;
    }

    product.isDeleted = true;
    product.isAvailable = false;
    await product.save();

    res.status(200).json({
      success: true,
      message: "Product deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 6. Cart Management (GET /cart, POST /cart/add, DELETE /cart/:itemId) ─────
export const getCart = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    let cart = await Cart.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
    }).populate("items.productId", "title images salePrice wholesalePrice isWholesaleEligible stock brandName");

    if (!cart) {
      cart = new Cart({
        userId: new mongoose.Types.ObjectId(req.user.id),
        items: [],
      });
      await cart.save();
    }

    const subtotal = cart.items.reduce((acc, item) => acc + item.price * item.quantity, 0);

    res.status(200).json({
      success: true,
      data: {
        cart,
        subtotal,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const addToCart = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const validationResult = addToCartSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { productId, quantity, isWholesale } = validationResult.data;

    const product = await Product.findOne({ _id: productId, isAvailable: true, isDeleted: false });
    if (!product) {
      res.status(404).json({ success: false, message: "Product not available." });
      return;
    }

    if (product.stock < quantity) {
      res.status(400).json({
        success: false,
        message: `Insufficient stock. Only ${product.stock} items remaining.`,
      });
      return;
    }

    // Determine unit price
    let unitPrice = product.salePrice;
    if (isWholesale) {
      if (!product.isWholesaleEligible || product.wholesalePrice === undefined) {
        res.status(400).json({
          success: false,
          message: "This product is not eligible for wholesale pricing.",
        });
        return;
      }
      unitPrice = product.wholesalePrice;
    }

    let cart = await Cart.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
    });

    if (!cart) {
      cart = new Cart({
        userId: new mongoose.Types.ObjectId(req.user.id),
        items: [],
      });
    }

    // Check if item already exists with matching wholesale option
    const existingIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId && !!item.isWholesale === !!isWholesale
    );

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += quantity;
      cart.items[existingIndex].price = unitPrice;
    } else {
      cart.items.push({
        productId: new mongoose.Types.ObjectId(productId),
        quantity,
        price: unitPrice,
        isWholesale: !!isWholesale,
      } as any);
    }

    await cart.save();
    await cart.populate("items.productId", "title images salePrice wholesalePrice stock brandName");

    res.status(200).json({
      success: true,
      message: "Item added to cart successfully!",
      data: cart,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const removeFromCart = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const itemId = getParam(req.params.itemId);

    const cart = await Cart.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
    });

    if (!cart) {
      res.status(404).json({ success: false, message: "Cart not found." });
      return;
    }

    cart.items.pull(itemId);
    await cart.save();

    res.status(200).json({
      success: true,
      message: "Item removed from cart.",
      data: cart,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const clearCart = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const cart = await Cart.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
    });

    if (cart) {
      cart.items = [] as any;
      await cart.save();
    }

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 7. Create Order (POST /orders/create) ────────────────────────────────────
// Calculates commission (5% default) and seller net earnings
export const createOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const validationResult = createOrderSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { shippingAddress, orderItems: passedItems } = validationResult.data;

    let itemsToProcess: { productId: string; quantity: number; isWholesale?: boolean }[] = [];

    // If order items were not passed, pull from user's active Cart
    if (passedItems && passedItems.length > 0) {
      itemsToProcess = passedItems;
    } else {
      const cart = await Cart.findOne({
        userId: new mongoose.Types.ObjectId(req.user.id),
      });

      if (!cart || cart.items.length === 0) {
        res.status(400).json({
          success: false,
          message: "Cart is empty. Please add items before checking out.",
        });
        return;
      }

      itemsToProcess = cart.items.map((i) => ({
        productId: i.productId.toString(),
        quantity: i.quantity,
        isWholesale: i.isWholesale,
      }));
    }

    let totalAmount = 0;
    const finalOrderItems = [];

    for (const item of itemsToProcess) {
      const product = await Product.findOne({
        _id: item.productId,
        isAvailable: true,
        isDeleted: false,
      });

      if (!product) {
        res.status(404).json({
          success: false,
          message: `Product ID ${item.productId} is not available.`,
        });
        return;
      }

      if (product.stock < item.quantity) {
        res.status(400).json({
          success: false,
          message: `Insufficient stock for '${product.title}'. Only ${product.stock} available.`,
        });
        return;
      }

      let unitPrice = product.salePrice;
      if (item.isWholesale) {
        if (product.isWholesaleEligible && product.wholesalePrice) {
          unitPrice = product.wholesalePrice;
        }
      }

      totalAmount += unitPrice * item.quantity;

      finalOrderItems.push({
        productId: product._id as any,
        sellerId: product.sellerId,
        brandName: product.brandName,
        title: product.title,
        quantity: item.quantity,
        price: unitPrice,
        isWholesale: !!item.isWholesale,
      });
    }

    // Commission Calculation (default: 5% platform commission)
    const platformCommissionRate = 0.05;
    const platformCommission = Math.round(totalAmount * platformCommissionRate * 100) / 100;
    const sellerEarnings = Math.round((totalAmount - platformCommission) * 100) / 100;

    const order = new Order({
      buyerId: new mongoose.Types.ObjectId(req.user.id),
      orderItems: finalOrderItems,
      totalAmount,
      platformCommissionRate,
      platformCommission,
      sellerEarnings,
      shippingAddress,
      paymentStatus: "Pending",
      orderStatus: "Pending",
    });

    await order.save();

    // If order was created from Cart, clear the cart
    await Cart.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(req.user.id) },
      { items: [] }
    );

    res.status(201).json({
      success: true,
      message: "Order placed successfully! Please proceed to payment.",
      data: order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 8. Get My Orders (GET /orders/my) ────────────────────────────────────────
export const getMyOrders = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const orders = await Order.find({
      buyerId: new mongoose.Types.ObjectId(req.user.id),
    })
      .populate("orderItems.productId", "title images brandName")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 9. Get Seller Orders (GET /orders/seller) ────────────────────────────────
export const getSellerOrders = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const sellerObjectId = new mongoose.Types.ObjectId(req.user.id);
    const orders = await Order.find({
      "orderItems.sellerId": sellerObjectId,
    })
      .populate("buyerId", "fullName email contactInfo")
      .populate("orderItems.productId", "title images brandName")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 10. Update Order Tracking Status (PATCH /orders/:id/status) ──────────────
// Protected: Seller or Admin
export const updateOrderStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const id = getParam(req.params.id);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid order ID." });
      return;
    }

    const validationResult = updateOrderStatusSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found." });
      return;
    }

    const isSeller = order.orderItems.some(
      (item) => item.sellerId?.toString() === req.user?.id
    );
    const isAdmin = req.user.role === "Admin" || req.user.role === "SuperAdmin";

    if (!isSeller && !isAdmin) {
      res.status(403).json({
        success: false,
        message: "Access denied. You can only update orders for your products.",
      });
      return;
    }

    order.orderStatus = validationResult.data.orderStatus;
    await order.save();

    // Trigger in-app + email notification to the buyer
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    await createNotification({
      recipientId: order.buyerId,
      senderId: req.user.id,
      type: "Order",
      title: `Order Status Update: ${order.orderStatus}`,
      message: `Your order #${order._id.toString().slice(-6)} tracking status has been updated to "${order.orderStatus}".`,
      link: `${frontendUrl}/orders`,
      sendEmailNotification: true,
      emailSubject: `Order Update: #${order._id.toString().slice(-6)} is now ${order.orderStatus}`,
    });

    res.status(200).json({
      success: true,
      message: `Order status updated to ${order.orderStatus}!`,
      data: order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 11. Add Dual-Rating Review (POST /reviews/:productId) ────────────────────
// Protected: Verified Buyer Only (order must be Paid)
export const addReview = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const productId = getParam(req.params.productId);
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ success: false, message: "Invalid product ID." });
      return;
    }

    const validationResult = createReviewSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const product = await Product.findOne({ _id: productId, isDeleted: false });
    if (!product) {
      res.status(404).json({ success: false, message: "Product not found." });
      return;
    }

    const buyerObjectId = new mongoose.Types.ObjectId(req.user.id);
    const productObjectId = new mongoose.Types.ObjectId(productId);

    // Rule: Verified Buyer Check (must have purchased this product with paymentStatus Paid)
    const verifiedPurchase = await Order.findOne({
      buyerId: buyerObjectId,
      "orderItems.productId": productObjectId,
      paymentStatus: "Paid",
    });

    if (!verifiedPurchase) {
      res.status(403).json({
        success: false,
        message:
          "Verified buyer restriction: You can only review products you have purchased and paid for.",
      });
      return;
    }

    const { productRating, brandRating, comment } = validationResult.data;

    // Check if user already reviewed this product
    let review = await Review.findOne({
      productId: productObjectId,
      buyerId: buyerObjectId,
    });

    if (review) {
      review.productRating = productRating;
      review.brandRating = brandRating;
      review.comment = comment;
      await review.save();
    } else {
      review = new Review({
        productId: productObjectId,
        businessId: product.businessId,
        buyerId: buyerObjectId,
        productRating,
        brandRating,
        comment,
      });
      await review.save();
    }

    // Recalculate average ratings automatically
    const stats = await Review.aggregate([
      { $match: { productId: productObjectId } },
      {
        $group: {
          _id: null,
          avgProduct: { $avg: "$productRating" },
          avgBrand: { $avg: "$brandRating" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      product.productRating = Math.round(stats[0].avgProduct * 10) / 10;
      product.brandRating = Math.round(stats[0].avgBrand * 10) / 10;
      product.totalReviews = stats[0].count;
      await product.save();
    }

    res.status(201).json({
      success: true,
      message: "Review submitted successfully!",
      data: {
        review,
        productRating: product.productRating,
        brandRating: product.brandRating,
        totalReviews: product.totalReviews,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 12. Get Product Reviews (GET /reviews/:productId) ────────────────────────
export const getProductReviews = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const productId = getParam(req.params.productId);
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ success: false, message: "Invalid product ID." });
      return;
    }

    const reviews = await Review.find({
      productId: new mongoose.Types.ObjectId(productId),
    })
      .populate("buyerId", "fullName profilePicture")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
