import { Response } from "express";
import { GoalTracker } from "../models/GoalTracker.model";
import {
  createGoalSchema,
  updateGoalSchema,
} from "../validations/goal.validation";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// Helper for Express 5 params
const getParam = (param: unknown): string => {
  if (Array.isArray(param)) return String(param[0]);
  return typeof param === "string" ? param : "";
};

// 1. Get Logged-in User's Goals
export const getMyGoals = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const filter: Record<string, any> = { userId: req.user.id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;

    const goals = await GoalTracker.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: goals.length,
      data: goals,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 2. Create Goal
export const createGoal = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const validationResult = createGoalSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { targetDate, milestones, ...rest } = validationResult.data;

    // Calculate initial progress based on completed milestones if any
    let progress = rest.progress;
    if (milestones && milestones.length > 0) {
      const completedCount = milestones.filter((m) => m.isCompleted).length;
      progress = Math.round((completedCount / milestones.length) * 100);
    }

    const goal = await GoalTracker.create({
      ...rest,
      progress,
      userId: req.user.id,
      targetDate: targetDate ? new Date(targetDate) : undefined,
      milestones,
    });

    res.status(201).json({
      success: true,
      message: "Goal created successfully.",
      data: goal,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 3. Update Goal
export const updateGoal = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const id = getParam(req.params.id);
    const validationResult = updateGoalSchema.safeParse(req.body);

    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const goal = await GoalTracker.findOne({ _id: id, userId: req.user.id });
    if (!goal) {
      res.status(404).json({ success: false, message: "Goal not found." });
      return;
    }

    const data = validationResult.data;
    if (data.title) goal.title = data.title;
    if (data.category) goal.category = data.category;
    if (data.targetDate) goal.targetDate = new Date(data.targetDate);
    if (data.status) goal.status = data.status;
    if (data.notes !== undefined) goal.notes = data.notes;
    if (data.isPrivate !== undefined) goal.isPrivate = data.isPrivate;

    if (data.milestones) {
      goal.milestones = data.milestones.map((m) => ({
        title: m.title,
        isCompleted: m.isCompleted,
        completedAt: m.isCompleted ? (m.completedAt ? new Date(m.completedAt) : new Date()) : undefined,
      })) as any;

      // Auto recalculate progress if milestones were provided
      const completedCount = goal.milestones.filter((m) => m.isCompleted).length;
      goal.progress = Math.round((completedCount / goal.milestones.length) * 100);
      if (goal.progress === 100) {
        goal.status = "Completed";
      }
    } else if (data.progress !== undefined) {
      goal.progress = data.progress;
      if (data.progress === 100) {
        goal.status = "Completed";
      }
    }

    await goal.save();

    res.status(200).json({
      success: true,
      message: "Goal updated successfully.",
      data: goal,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 4. Delete Goal
export const deleteGoal = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const id = getParam(req.params.id);
    const deleted = await GoalTracker.findOneAndDelete({
      _id: id,
      userId: req.user.id,
    });

    if (!deleted) {
      res.status(404).json({ success: false, message: "Goal not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Goal deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
