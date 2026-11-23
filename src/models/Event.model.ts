import { Schema, model, Document, Types } from "mongoose";

export interface IArchiveMedia {
  type: "video" | "image" | "writeup";
  url: string;
  caption?: string;
}

export interface IEvent extends Document {
  title: string;
  description: string;
  organizerId: Types.ObjectId; // Linked to User model
  date: Date;
  time: string;
  locationType: "Online" | "Offline";
  locationDetails: string; // Zoom/Google Meet link or Physical Address
  bannerUrl?: string;
  ticketPrice: number; // 0 for free events
  maxAttendees?: number;
  isPast: boolean;
  isCancelled: boolean;
  archiveMedia: IArchiveMedia[];
  registeredAttendees: Types.ObjectId[]; // Array of User IDs who registered (RSVP)
  createdAt: Date;
  updatedAt: Date;
}

const ArchiveMediaSchema = new Schema<IArchiveMedia>(
  {
    type: { type: String, enum: ["video", "image", "writeup"], required: true },
    url: { type: String, required: true },
    caption: { type: String },
  },
  { _id: false }
);

const EventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    organizerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    locationType: { type: String, enum: ["Online", "Offline"], required: true },
    locationDetails: { type: String, required: true },
    bannerUrl: { type: String },
    ticketPrice: { type: Number, default: 0, min: 0 },
    maxAttendees: { type: Number, min: 1 },
    isPast: { type: Boolean, default: false },
    isCancelled: { type: Boolean, default: false },
    archiveMedia: [ArchiveMediaSchema],
    registeredAttendees: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

EventSchema.index({ date: 1 });
EventSchema.index({ isPast: 1, isCancelled: 1 });
EventSchema.index({ organizerId: 1 });

export const Event = model<IEvent>("Event", EventSchema);
