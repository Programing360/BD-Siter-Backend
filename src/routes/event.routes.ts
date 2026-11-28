import { Router } from "express";
import {
  createEvent,
  getEvents,
  getEventById,
  registerForEvent,
  cancelEvent,
  archiveEvent,
  updateEvent,
  getMyRegistrations,
} from "../controllers/event.controller";
import { verifyToken, optionalAuth, authorizeRoles } from "../middlewares/auth.middleware";

const router = Router();

router.get("/my-registrations", verifyToken, getMyRegistrations);
router.post("/create", verifyToken, createEvent);
router.post("/", verifyToken, createEvent);
router.get("/", getEvents);
router.get("/:id", getEventById);
router.patch("/:id", verifyToken, updateEvent);
router.post("/:id/register", optionalAuth, registerForEvent);
router.delete("/:id", verifyToken, cancelEvent);
router.patch("/:id/archive", verifyToken, archiveEvent);

const eventRoutes = router;

export default eventRoutes;
