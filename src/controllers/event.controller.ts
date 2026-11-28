import { Request, Response } from "express";
import { Event } from "../models/Event.model";
import {
  createEventSchema,
  updateEventSchema,
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

    const data = validationResult.data;
    const ticketPrice = Number(data.ticketPrice) || 0;
    const isFree = data.isFree !== undefined ? Boolean(data.isFree) : ticketPrice === 0;

    const newEvent = new Event({
      ...data,
      ticketPrice: isFree ? 0 : ticketPrice,
      isFree,
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
      .populate("organizerId", "fullName profilePicture role email")
      .populate("registeredAttendees", "fullName profilePicture email location referralCode")
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
    const event = await Event.findById(id)
      .populate("organizerId", "fullName profilePicture role email")
      .populate("registeredAttendees", "fullName profilePicture email location referralCode");

    if (!event) {
      res.status(404).json({ success: false, message: "Event not found." });
      return;
    }

    res.status(200).json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 4b. Get Logged-In User Registrations ─────────────────────────────────
export const getMyRegistrations = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const registeredEvents = await Event.find({
      registeredAttendees: userId,
      isCancelled: false,
    }).sort({ date: 1 });

    const data = registeredEvents.map((ev) => {
      const ticketCode = `BDS-PASS-${ev._id.toString().slice(-4).toUpperCase()}-${userId.slice(-4).toUpperCase()}`;
      return {
        ...ev.toObject(),
        ticketCode,
        isUserRegistered: true,
      };
    });

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
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

    const isAlreadyRegistered = event.registeredAttendees.some(
      (attendeeId) => attendeeId.toString() === userId
    );

    const ticketCode = `BDS-PASS-${eventId.slice(-4).toUpperCase()}-${userId.slice(-4).toUpperCase()}`;

    if (isAlreadyRegistered) {
      res.status(200).json({
        success: true,
        alreadyRegistered: true,
        message: "You are already registered for this event.",
        ticketCode,
        data: {
          ...event.toObject(),
          ticketCode,
          isUserRegistered: true,
        },
      });
      return;
    }

    event.registeredAttendees.push(userId as any);
    await event.save();

    res.status(200).json({
      success: true,
      message: "Successfully registered for the event!",
      ticketCode,
      data: {
        ...event.toObject(),
        ticketCode,
        isUserRegistered: true,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 5. Cancel or Delete Event (DELETE /api/events/:id) ──────────────────────
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
        message: "Access denied. Only the organizer or admin can manage this event.",
      });
      return;
    }

    const permanent = req.query.permanent === "true";
    if (permanent && isAdmin) {
      await Event.findByIdAndDelete(id);
      res.status(200).json({
        success: true,
        message: "Event permanently removed.",
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

// ─── 5b. Update Event (PATCH /api/events/:id) ─────────────────────────────────
export const updateEvent = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const validationResult = updateEventSchema.safeParse(req.body);

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
        message: "Access denied. Only the organizer or admin can update this event.",
      });
      return;
    }

    const data = validationResult.data;
    if (data.title !== undefined) event.title = data.title;
    if (data.description !== undefined) event.description = data.description;
    if (data.wing !== undefined) event.wing = data.wing;
    if (data.eventType !== undefined) event.eventType = data.eventType;
    if (data.speaker !== undefined) event.speaker = data.speaker;
    if (data.date !== undefined) event.date = new Date(data.date);
    if (data.time !== undefined) event.time = data.time;
    if (data.locationType !== undefined) event.locationType = data.locationType;
    if (data.locationDetails !== undefined) event.locationDetails = data.locationDetails;
    if (data.bannerUrl !== undefined) event.bannerUrl = data.bannerUrl;
    if (data.ticketPrice !== undefined) {
      event.ticketPrice = Number(data.ticketPrice) || 0;
      event.isFree = event.ticketPrice === 0;
    }
    if (data.isFree !== undefined) {
      event.isFree = Boolean(data.isFree);
      if (event.isFree) event.ticketPrice = 0;
    }
    if (data.maxAttendees !== undefined) event.maxAttendees = data.maxAttendees;
    if (data.isPast !== undefined) event.isPast = Boolean(data.isPast);
    if (data.isCancelled !== undefined) event.isCancelled = Boolean(data.isCancelled);
    if (data.recordingUrl !== undefined) event.recordingUrl = data.recordingUrl;
    if (data.slidesUrl !== undefined) event.slidesUrl = data.slidesUrl;
    if (data.summaryNotes !== undefined) event.summaryNotes = data.summaryNotes;

    await event.save();
    await event.populate("organizerId", "fullName profilePicture role email");
    await event.populate("registeredAttendees", "fullName profilePicture email location referralCode");

    res.status(200).json({
      success: true,
      message: "Event updated successfully.",
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
    if (validationResult.data.recordingUrl !== undefined) {
      event.recordingUrl = validationResult.data.recordingUrl;
    }
    if (validationResult.data.slidesUrl !== undefined) {
      event.slidesUrl = validationResult.data.slidesUrl;
    }
    if (validationResult.data.summaryNotes !== undefined) {
      event.summaryNotes = validationResult.data.summaryNotes;
    }
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
