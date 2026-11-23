import { Request, Response } from "express";
import { Event } from "../models/Event.model";
import {
  createEventSchema,
  eventRegistrationSchema,
  archiveEventSchema,
} from "../validations/event.validation";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// Helper for Express 5 params
const getParam = (param: unknown): string => {
  if (Array.isArray(param)) return String(param[0]);
  return typeof param === "string" ? param : "";
};

// ─── 1. Create New Event ──────────────────────────────────────────────────────
export const createEvent = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const validationResult = createEventSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const organizerId = req.user?.id || validationResult.data.organizerId;
    if (!organizerId) {
      res.status(401).json({ success: false, message: "Organizer ID or authentication required." });
      return;
    }

    const newEvent = new Event({
      ...validationResult.data,
      organizerId,
    });
    await newEvent.save();

    res.status(201).json({
      success: true,
      message: "Event created successfully!",
      data: newEvent,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 2. Get All Events (Upcoming / Past / Filtered) ───────────────────────────
export const getEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const filterType = req.query.filter as string; // "upcoming" | "past" | undefined
    const now = new Date();

    const query: Record<string, any> = {};

    if (filterType === "past") {
      query.$or = [{ isPast: true }, { date: { $lt: now } }];
    } else if (filterType === "upcoming") {
      query.isPast = false;
      query.isCancelled = false;
      query.date = { $gte: now };
    }

    const events = await Event.find(query)
      .populate("organizerId", "fullName profilePicture role")
      .sort({ date: filterType === "past" ? -1 : 1 });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 3. Get Single Event by ID ────────────────────────────────────────────────
export const getEventById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const event = await Event.findById(id).populate(
      "organizerId",
      "fullName profilePicture role"
    );

    if (!event) {
      res.status(404).json({ success: false, message: "Event not found." });
      return;
    }

    res.status(200).json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 4. Register / RSVP for an Event ──────────────────────────────────────────
export const registerForEvent = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const eventId = getParam(req.params.eventId || req.params.id);
    const validationResult = eventRegistrationSchema.safeParse(req.body);

    const userId = req.user?.id || (validationResult.success ? validationResult.data.userId : null);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User authentication or userId is required.",
      });
      return;
    }

    const event = await Event.findById(eventId);
    if (!event) {
      res.status(404).json({ success: false, message: "Event not found." });
      return;
    }

    if (event.isCancelled) {
      res.status(400).json({
        success: false,
        message: "Cannot register for a cancelled event.",
      });
      return;
    }

    if (event.isPast || new Date(event.date) < new Date()) {
      res.status(400).json({
        success: false,
        message: "Cannot register for a past event.",
      });
      return;
    }

    // Check capacity limit
    if (
      event.maxAttendees &&
      event.registeredAttendees.length >= event.maxAttendees
    ) {
      res.status(400).json({
        success: false,
        message: "This event has reached its maximum registration capacity.",
      });
      return;
    }

    // Check if already registered
    const isAlreadyRegistered = event.registeredAttendees.some(
      (attendeeId) => attendeeId.toString() === userId
    );

    if (isAlreadyRegistered) {
      res.status(400).json({
        success: false,
        message: "You are already registered for this event.",
      });
      return;
    }

    event.registeredAttendees.push(userId as any);
    await event.save();

    res.status(200).json({
      success: true,
      message: "Successfully registered for the event!",
      data: event,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 5. Cancel Event (DELETE /api/events/:id) ──────────────────────────────────
export const cancelEvent = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const event = await Event.findById(id);

    if (!event) {
      res.status(404).json({ success: false, message: "Event not found." });
      return;
    }

    const isOrganizer = event.organizerId.toString() === req.user?.id;
    const isAdmin =
      req.user?.role === "Admin" || req.user?.role === "SuperAdmin";

    if (!isOrganizer && !isAdmin) {
      res.status(403).json({
        success: false,
        message: "Access denied. Only the organizer or admin can cancel this event.",
      });
      return;
    }

    event.isCancelled = true;
    await event.save();

    res.status(200).json({
      success: true,
      message: "Event has been cancelled successfully.",
      data: event,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 6. Archive Past Event (PATCH /api/events/:id/archive) ────────────────────
export const archiveEvent = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const validationResult = archiveEventSchema.safeParse(req.body);

    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const event = await Event.findById(id);
    if (!event) {
      res.status(404).json({ success: false, message: "Event not found." });
      return;
    }

    const isOrganizer = event.organizerId.toString() === req.user?.id;
    const isAdmin =
      req.user?.role === "Admin" || req.user?.role === "SuperAdmin";

    if (!isOrganizer && !isAdmin) {
      res.status(403).json({
        success: false,
        message: "Access denied. Only the organizer or admin can archive this event.",
      });
      return;
    }

    event.isPast = true;
    if (validationResult.data.archiveMedia) {
      event.archiveMedia = validationResult.data.archiveMedia;
    }
    await event.save();

    res.status(200).json({
      success: true,
      message: "Event archived with media materials successfully.",
      data: event,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
