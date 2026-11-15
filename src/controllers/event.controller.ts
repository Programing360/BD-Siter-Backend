import { Request, Response } from "express";
import { Event } from "../models/Event.model";
import {
  createEventSchema,
  eventRegistrationSchema,
} from "../validations/event.validation";

// Create New Event
export const createEvent = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const validationResult = createEventSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const newEvent = new Event(validationResult.data);
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

// Get All Events
export const getEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const events = await Event.find()
      .populate("organizerId", "fullName profilePicture role")
      .sort({ date: 1 });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// Register / RSVP for an Event
export const registerForEvent = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { eventId } = req.params;
    const validationResult = eventRegistrationSchema.safeParse(req.body);

    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { userId } = validationResult.data;

    const event = await Event.findById(eventId);
    if (!event) {
      res.status(404).json({ success: false, message: "Event not found." });
      return;
    }

    // Check if already registered
    if (event.registeredAttendees.includes(userId as any)) {
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
