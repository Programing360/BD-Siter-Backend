import { Response } from "express";
import mongoose from "mongoose";
import axios from "axios";
import { Product } from "../models/Product.model";
import { Order } from "../models/Order.model";
import { Cart } from "../models/Cart.model";
import { Review } from "../models/Review.model";
import { Business } from "../models/Business.model";
import { Payment } from "../models/Payment.model";
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

    // Gracefully handle custom category strings (e.g., "Modest Fashion") as subCategory if not explicitly provided
    const subCategory =
      rest.subCategory ||
      (typeof req.body.category === "string" &&
        !["product", "service"].includes(req.body.category.trim().toLowerCase())
        ? req.body.category.trim()
        : undefined);

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

    const slug =
      (rest as any).slug ||
      rest.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    const product = new Product({
      ...rest,
      slug,
      subCategory,
      businessId: new mongoose.Types.ObjectId(businessId),
      sellerId: new mongoose.Types.ObjectId(req.user.id),
      brandName,
      price: rest.salePrice,
      isAvailable: true,
      status: "Approved",
      isDeleted: false,
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

    const query: any = {
      isAvailable: { $ne: false },
      isDeleted: { $ne: true },
    };

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

// ─── 3. Get Single Product (GET /products/:id or GET /products/:slug) ───────
export const getProductById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const idOrSlug = getParam(req.params.id);
    if (!idOrSlug) {
      res.status(400).json({ success: false, message: "Product identifier is required." });
      return;
    }

    const escapeRegex = (text: string) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

    let filter: any = { isDeleted: false };
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      filter.$or = [{ _id: idOrSlug }, { slug: idOrSlug }];
    } else {
      filter.$or = [
        { slug: idOrSlug },
        { title: { $regex: new RegExp("^" + escapeRegex(idOrSlug.replace(/-/g, " ")), "i") } },
      ];
    }

    const product = await Product.findOne(filter)
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
// Helper to format Cart Document cleanly
function formatCartResponse(cartDoc: any) {
  let subtotal = 0;
  let totalItems = 0;

  const items = (cartDoc?.items || []).map((item: any) => {
    const p = item.productId || {};
    const title = p.title || "Product";
    const brandName = p.brandName || "";
    const slug = p.slug || (p._id ? p._id.toString() : "");
    const image = (Array.isArray(p.images) && p.images[0]) || "";
    const stock = typeof p.stock === "number" ? p.stock : 999;
    const mrp = typeof p.mrpPrice === "number" ? p.mrpPrice : (item.price || 0);
    const salePrice = typeof p.salePrice === "number" ? p.salePrice : (item.price || 0);
    const price = item.price || salePrice;
    const quantity = item.quantity || 1;
    const lineTotal = price * quantity;

    subtotal += lineTotal;
    totalItems += quantity;

    return {
      _id: item._id ? item._id.toString() : undefined,
      productId: (p._id ? p._id.toString() : item.productId ? item.productId.toString() : ""),
      title,
      slug,
      brandName,
      price,
      mrp,
      salePrice,
      image,
      quantity,
      stock,
      lineTotal,
      isWholesale: !!item.isWholesale,
    };
  });

  return {
    _id: cartDoc._id ? cartDoc._id.toString() : undefined,
    userId: cartDoc.userId ? cartDoc.userId.toString() : undefined,
    items,
    totalItems,
    subtotal,
  };
}

// ─── 5. Get User's Cart (GET /cart) ───────────────────────────────────────────
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
    }).populate("items.productId", "title slug images mrpPrice salePrice wholesalePrice isWholesaleEligible stock brandName");

    if (!cart) {
      cart = new Cart({
        userId: new mongoose.Types.ObjectId(req.user.id),
        items: [],
      });
      await cart.save();
    }

    const formatted = formatCartResponse(cart);

    res.status(200).json({
      success: true,
      data: formatted,
      cart: formatted,
      items: formatted.items,
      totalItems: formatted.totalItems,
      subtotal: formatted.subtotal,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 6. Add Item to Cart (POST /cart/add) ──────────────────────────────────────
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

    let productFilter: any = { isDeleted: { $ne: true }, isAvailable: { $ne: false } };
    if (mongoose.Types.ObjectId.isValid(productId)) {
      productFilter._id = new mongoose.Types.ObjectId(productId);
    } else {
      productFilter.$or = [{ _id: productId }, { slug: productId }];
    }

    const product = await Product.findOne(productFilter);
    if (!product) {
      res.status(404).json({ success: false, message: "Product not found or unavailable." });
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
    let unitPrice = product.salePrice || product.price || 0;
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

    const targetProductIdStr = (product._id as any).toString();

    // Check if item already exists with matching wholesale option
    const existingIndex = cart.items.findIndex(
      (item) => item.productId.toString() === targetProductIdStr && !!item.isWholesale === !!isWholesale
    );

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += quantity;
      cart.items[existingIndex].price = unitPrice;
    } else {
      cart.items.push({
        productId: product._id,
        quantity,
        price: unitPrice,
        isWholesale: !!isWholesale,
      } as any);
    }

    await cart.save();
    await cart.populate("items.productId", "title slug images mrpPrice salePrice wholesalePrice stock brandName");

    const formatted = formatCartResponse(cart);

    res.status(200).json({
      success: true,
      message: "Item added to cart successfully!",
      data: formatted,
      cart: formatted,
      items: formatted.items,
      totalItems: formatted.totalItems,
      subtotal: formatted.subtotal,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Update Item Quantity (PUT/PATCH /cart/:itemId or /cart) ──────────────────
export const updateCartItem = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const targetId = getParam(req.params.itemId) || req.body.productId;
    const quantity = Number(req.body.quantity);

    if (!targetId) {
      res.status(400).json({ success: false, message: "Item or product ID is required." });
      return;
    }

    const cart = await Cart.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
    });

    if (!cart) {
      res.status(404).json({ success: false, message: "Cart not found." });
      return;
    }

    // Match either cart item _id or item.productId
    const itemIndex = cart.items.findIndex(
      (item: any) =>
        (item._id && item._id.toString() === targetId) ||
        (item.productId && item.productId.toString() === targetId)
    );

    if (itemIndex === -1) {
      res.status(404).json({ success: false, message: "Item not found in cart." });
      return;
    }

    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
    }

    await cart.save();
    await cart.populate("items.productId", "title slug images mrpPrice salePrice wholesalePrice stock brandName");

    const formatted = formatCartResponse(cart);

    res.status(200).json({
      success: true,
      message: "Cart updated successfully.",
      data: formatted,
      cart: formatted,
      items: formatted.items,
      totalItems: formatted.totalItems,
      subtotal: formatted.subtotal,
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

    const itemId = getParam(req.params.itemId) || (req.query.productId as string);

    const cart = await Cart.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
    });

    if (!cart) {
      res.status(404).json({ success: false, message: "Cart not found." });
      return;
    }

    // Remove matching item by subdoc _id or productId
    cart.items = cart.items.filter(
      (item: any) =>
        !(
          (item._id && item._id.toString() === itemId) ||
          (item.productId && item.productId.toString() === itemId)
        )
    ) as any;

    await cart.save();
    await cart.populate("items.productId", "title slug images mrpPrice salePrice wholesalePrice stock brandName");

    const formatted = formatCartResponse(cart);

    res.status(200).json({
      success: true,
      message: "Item removed from cart.",
      data: formatted,
      cart: formatted,
      items: formatted.items,
      totalItems: formatted.totalItems,
      subtotal: formatted.subtotal,
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
      data: {
        items: [],
        totalItems: 0,
        subtotal: 0,
      },
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
    const orderNumber = `BDS-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const order = new Order({
      orderNumber,
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

    // Order created with status Pending. Cart will be cleared upon confirmed payment in webhook/verify.
    const backendUrl = (
      process.env.BACKEND_URL || "http://localhost:5000"
    ).replace(/\/+$/, "");
    const frontendUrl = (
      process.env.FRONTEND_URL || "http://localhost:3000"
    ).replace(/\/+$/, "");

    let rawBaseUrl = (
      process.env.ZINIPAY_BASE_URL || "https://api.zinipay.com"
    ).trim().replace(/\/+$/, "");
    if (!rawBaseUrl.endsWith("/v1")) {
      rawBaseUrl = `${rawBaseUrl}/v1`;
    }
    const createEndpoint = `${rawBaseUrl}/payment/create`;
    const apiKey = (process.env.ZINIPAY_API_KEY || "").trim();

    if (!apiKey) {
      res.status(500).json({
        success: false,
        message: "Payment gateway is not configured (missing ZINIPAY_API_KEY).",
      });
      return;
    }

    const transId = `TRAN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const payment = await Payment.create({
      transactionId: transId,
      gateway: "ZiniPay",
      userId: req.user.id,
      paymentType: "Order",
      referenceId: (order._id as any).toString(),
      amount: totalAmount,
      currency: "BDT",
      status: "Pending",
    });

    const cusName = (req.user as any).fullName || shippingAddress.district || "Sister Customer";
    const cusEmail = (req.user as any).email || "customer@bdsisters.org";
    const cusPhone = shippingAddress.phone || "01700000000";

    const payload = {
      amount: totalAmount,
      currency: "BDT",
      cus_name: cusName,
      cus_email: cusEmail,
      cus_phone: cusPhone,
      customer_name: cusName,
      customer_email: cusEmail,
      customer_phone: cusPhone,
      redirect_url: `${backendUrl}/api/payment/zinipay/verify?tranId=${transId}`,
      cancel_url: `${backendUrl}/api/payment/zinipay/cancel?tranId=${transId}`,
      webhook_url: `${backendUrl}/api/payment/zinipay/webhook`,
      metadata: {
        transaction_id: transId,
        payment_type: "Order",
        reference_id: (order._id as any).toString(),
        user_id: req.user.id,
      },
    };

    try {
      const zinipayRes = await axios.post(createEndpoint, payload, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "zini-api-key": apiKey,
          "zinipay-api-key": apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 15000,
      });

      const resData = zinipayRes.data;
      const paymentUrl =
        resData?.payment_url ||
        resData?.data?.payment_url ||
        resData?.GatewayPageURL ||
        resData?.paymentUrl;
      const invoiceId =
        resData?.invoice_id ||
        resData?.data?.invoice_id ||
        resData?.val_id ||
        resData?.id;

      if (!paymentUrl) {
        payment.status = "Failed";
        payment.gatewayResponse = resData;
        await payment.save();

        res.status(400).json({
          success: false,
          message:
            resData?.message ||
            "Failed to obtain real payment URL from ZiniPay gateway.",
        });
        return;
      }

      payment.invoiceId = invoiceId;
      payment.gatewayResponse = resData;
      await payment.save();

      res.status(201).json({
        success: true,
        message: "Order placed successfully! Redirecting to ZiniPay...",
        data: {
          ...order.toObject(),
          paymentUrl,
          payment_url: paymentUrl,
          invoiceId,
          transId,
        },
        paymentUrl,
        payment_url: paymentUrl,
      });
      return;
    } catch (payErr: any) {
      const errData = payErr.response?.data;
      const errStatus = payErr.response?.status || 400;
      const errMsg =
        errData?.message ||
        errData?.msg ||
        (typeof errData === "string" ? errData : null) ||
        payErr.message ||
        "ZiniPay gateway error";

      console.error("ZiniPay order initiation error:", {
        status: errStatus,
        data: errData,
        message: errMsg,
      });

      payment.status = "Failed";
      payment.gatewayResponse = errData || { error: errMsg };
      await payment.save();

      res
        .status(errStatus >= 400 && errStatus < 500 ? errStatus : 400)
        .json({
          success: false,
          gateway: "ZiniPay",
          message: errMsg.startsWith("ZiniPay")
            ? errMsg
            : `ZiniPay Error: ${errMsg}`,
          error: errData,
        });
      return;
    }
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

// ─── 9b. Get Orders (General: Admin sees all, Seller sees seller orders, Buyer sees buyer orders) ─
export const getOrders = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const isAdmin = req.user.role === "Admin" || req.user.role === "SuperAdmin";
    let query: Record<string, any> = {};

    if (!isAdmin) {
      const userObjectId = new mongoose.Types.ObjectId(req.user.id);
      query = {
        $or: [
          { buyerId: userObjectId },
          { "orderItems.sellerId": userObjectId },
        ],
      };
    }

    const orders = await Order.find(query)
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
