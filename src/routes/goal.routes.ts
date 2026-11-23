import { Router } from "express";
import {
  getMyGoals,
  createGoal,
  updateGoal,
  deleteGoal,
} from "../controllers/goal.controller";
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

// Protect all goal routes
router.use(verifyToken);

router.get("/", getMyGoals);
router.post("/", createGoal);
router.patch("/:id", updateGoal);
router.delete("/:id", deleteGoal);

export default router;
