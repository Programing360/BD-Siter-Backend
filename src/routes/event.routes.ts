import { Router } from "express";
import {
  createEvent,
  getEvents,
  registerForEvent,
} from "../controllers/event.controller";

const router = Router();

router.post("/create", createEvent);
router.get("/", getEvents);
router.post("/:eventId/register", registerForEvent);

const eventRoutes = router;

export default eventRoutes;
