import { Schema, model, Document } from "mongoose";

export interface IEvent extends Document {
  title: string;
  description: string;
  organizerId: Schema.Types.ObjectId; // Linked to User model
  date: Date;
  time: string;
  locationType: "Online" | "Offline";
  locationDetails: string; // Zoom/Google Meet link or Physical Address
  bannerUrl?: string;
  registeredAttendees: Schema.Types.ObjectId[]; // Array of User IDs who registered (RSVP)
  createdAt: Date;
  updatedAt: Date;
}

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
    registeredAttendees: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

export const Event = model<IEvent>("Event", EventSchema);
