import { Router } from "express";
import {
  createEvent,
  getEvents,
  getEventById,
  registerForEvent,
  cancelEvent,
  archiveEvent,
} from "../controllers/event.controller";
import { verifyToken, optionalAuth } from "../middlewares/auth.middleware";

const router = Router();

router.post("/create", verifyToken, createEvent);
router.get("/", getEvents);
router.get("/:id", getEventById);
router.post("/:id/register", optionalAuth, registerForEvent);
router.delete("/:id", verifyToken, cancelEvent);
router.patch("/:id/archive", verifyToken, archiveEvent);

const eventRoutes = router;

export default eventRoutes;
