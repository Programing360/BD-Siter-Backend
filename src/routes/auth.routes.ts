import { Router } from "express";
import { registerUser, loginUser } from "../controllers/auth.controller";
import { validateReferral } from "../middlewares/referral.middleware";

const router = Router();

// মিডলওয়্যার প্রথমে রিকোয়েস্ট চেক করবে, তারপর কন্ট্রোলারে যাবে
router.post("/register", validateReferral, registerUser);
router.post("/login", loginUser);

export default router;
