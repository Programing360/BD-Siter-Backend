import { Router } from "express";
import {
  addProduct,
  getProducts,
  createOrder,
} from "../controllers/ecommerce.controller";

const router = Router();

router.post("/products/add", addProduct);
router.get("/products", getProducts);
router.post("/orders/create", createOrder);

const ecommerceRoutes = router;

export default ecommerceRoutes;
