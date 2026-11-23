import { Schema, model, Document } from "mongoose";

export interface IContactForm extends Document {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: "New" | "Replied" | "Archived";
  replyNotes?: string;
  repliedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ContactFormSchema = new Schema<IContactForm>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["New", "Replied", "Archived"],
      default: "New",
    },
    replyNotes: { type: String },
    repliedAt: { type: Date },
  },
  { timestamps: true }
);

ContactFormSchema.index({ status: 1 });
ContactFormSchema.index({ createdAt: -1 });

export const ContactForm = model<IContactForm>("ContactForm", ContactFormSchema);
