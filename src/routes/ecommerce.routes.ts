import { Router } from "express";
import {
  addProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
  createOrder,
  getMyOrders,
  getSellerOrders,
  updateOrderStatus,
  addReview,
  getProductReviews,
} from "../controllers/ecommerce.controller";
import { verifyToken, optionalAuth } from "../middlewares/auth.middleware";

const router = Router();

// ─── Products ─────────────────────────────────────────────
router.post("/products/add", verifyToken, addProduct);
router.get("/products", optionalAuth, getProducts);
router.get("/products/:id", optionalAuth, getProductById);
router.patch("/products/:id", verifyToken, updateProduct);
router.delete("/products/:id", verifyToken, deleteProduct);

// ─── Cart ─────────────────────────────────────────────────
router.get("/cart", verifyToken, getCart);
router.post("/cart/add", verifyToken, addToCart);
router.delete("/cart/:itemId", verifyToken, removeFromCart);
router.delete("/cart", verifyToken, clearCart);

// ─── Orders ───────────────────────────────────────────────
router.post("/orders/create", verifyToken, createOrder);
router.get("/orders/my", verifyToken, getMyOrders);
router.get("/orders/seller", verifyToken, getSellerOrders);
router.patch("/orders/:id/status", verifyToken, updateOrderStatus);

// ─── Reviews ──────────────────────────────────────────────
router.post("/reviews/:productId", verifyToken, addReview);
router.get("/reviews/:productId", optionalAuth, getProductReviews);

const ecommerceRoutes = router;

export default ecommerceRoutes;
