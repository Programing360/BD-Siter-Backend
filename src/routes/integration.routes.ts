import { Router } from "express";
import {
  getMemberForIntegration,
  getWingsDirectoryForIntegration,
  getEventsForIntegration,
} from "../controllers/integration.controller";
import { verifyApiKey } from "../middlewares/apiKey.middleware";

const router = Router();

// Protect all integration endpoints with API Key verification
router.use(verifyApiKey);

router.get("/members/:id", getMemberForIntegration);
router.get("/wings", getWingsDirectoryForIntegration);
router.get("/events", getEventsForIntegration);

export default router;
