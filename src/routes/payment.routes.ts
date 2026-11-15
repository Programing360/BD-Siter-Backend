import { Router } from "express";
import {
  initPayment,
  paymentSuccess,
  paymentFail,
  paymentCancel,
} from "../controllers/payment.controller";

const router = Router();

router.post("/init", initPayment);
router.post("/success", paymentSuccess);
router.get("/success", paymentSuccess); // SSLCommerz redirect support
router.post("/fail", paymentFail);
router.post("/cancel", paymentCancel);

const paymentRoutes = router;

export default paymentRoutes;
