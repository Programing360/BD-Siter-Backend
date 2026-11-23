import { Router } from "express";
import {
  initZiniPayPayment,
  verifyZiniPayPayment,
  ziniPayWebhook,
  ziniPayCancel,
  initPayment,
  paymentSuccess,
  paymentFail,
  paymentCancel,
  paymentIpn,
} from "../controllers/payment.controller";
import { optionalAuth } from "../middlewares/auth.middleware";

const router = Router();

// ─── ZiniPay Dedicated Endpoints ──────────────────────────────
router.post("/zinipay/init", optionalAuth, initZiniPayPayment);
router.post("/zinipay/verify", verifyZiniPayPayment);
router.get("/zinipay/verify", verifyZiniPayPayment); // For browser return redirects
router.post("/zinipay/webhook", ziniPayWebhook);
router.get("/zinipay/cancel", ziniPayCancel);
router.post("/zinipay/cancel", ziniPayCancel);

// ─── Backwards-Compatible Aliases ─────────────────────────────
router.post("/init", optionalAuth, initPayment);
router.post("/success", paymentSuccess);
router.get("/success", paymentSuccess);
router.post("/fail", paymentFail);
router.get("/fail", paymentFail);
router.post("/cancel", paymentCancel);
router.get("/cancel", paymentCancel);
router.post("/ipn", paymentIpn);
router.post("/webhook", ziniPayWebhook);

const paymentRoutes = router;

export default paymentRoutes;
