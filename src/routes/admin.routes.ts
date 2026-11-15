import { Router } from "express";
import {
  getPendingUsers,
  updateUserStatus,
  getAllBusinessesForAdmin,
  updateBusinessSubscription,
} from "../controllers/admin.controller";

const router = Router();

router.get("/users/pending", getPendingUsers);
router.patch("/users/:userId/status", updateUserStatus);
router.get("/businesses", getAllBusinessesForAdmin);
router.patch(
  "/businesses/:businessId/subscription",
  updateBusinessSubscription,
);

const adminRoutes = router;

export default adminRoutes;
