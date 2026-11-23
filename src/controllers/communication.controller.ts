import { Request, Response } from "express";
import { ContactForm } from "../models/ContactForm.model";
import { Newsletter } from "../models/Newsletter.model";
import { logAdminAction } from "../models/AuditLog.model";
import {
  contactFormSchema,
  updateContactStatusSchema,
  newsletterSubscribeSchema,
} from "../validations/communication.validation";
import { sendEmail } from "../utils/sendEmail";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// Helper for Express 5 params
const getParam = (param: unknown): string => {
  if (Array.isArray(param)) return String(param[0]);
  return typeof param === "string" ? param : "";
};

// ─── Contact Form ────────────────────────────────────────────────────────────

// 1. Submit Contact Form (Public)
export const submitContactForm = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const validationResult = contactFormSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { name, email, phone, subject, message } = validationResult.data;

    const contact = await ContactForm.create({
      name,
      email,
      phone,
      subject,
      message,
    });

    // Send confirmation email to the user
    try {
      await sendEmail({
        to: email,
        subject: `Message Received: ${subject} - BDSisters.org`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #0f766e;">Assalamu Alaikum, ${name}!</h2>
            <p>Thank you for reaching out to BDSisters.org. We have received your message regarding: <strong>"${subject}"</strong>.</p>
            <p>Our team will get back to you in shaa Allah as soon as possible.</p>
            <br/>
            <p>Team BDSisters.org</p>
          </div>
        `,
        text: `Assalamu Alaikum ${name}. Thank you for contacting BDSisters.org. We received your message regarding "${subject}" and will respond shortly in shaa Allah.`,
      });
    } catch (emailErr) {
      console.error("Failed to send contact confirmation email:", (emailErr as Error).message);
    }

    res.status(201).json({
      success: true,
      message: "Your message has been sent successfully. We will contact you soon in shaa Allah.",
      data: contact,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 2. Get All Contact Messages (Admin)
export const getContactMessages = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (req.query.status) filter.status = req.query.status;

    const [messages, total] = await Promise.all([
      ContactForm.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ContactForm.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: messages,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 3. Update Contact Message Status (Admin)
export const updateContactMessageStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const validationResult = updateContactStatusSchema.safeParse(req.body);

    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { status, replyNotes } = validationResult.data;
    const message = await ContactForm.findById(id);

    if (!message) {
      res.status(404).json({ success: false, message: "Contact message not found." });
      return;
    }

    message.status = status;
    if (replyNotes !== undefined) message.replyNotes = replyNotes;
    if (status === "Replied") message.repliedAt = new Date();

    await message.save();

    if (req.user) {
      await logAdminAction({
        adminId: req.user.id,
        action: "UPDATE_CONTACT_MESSAGE_STATUS",
        targetModel: "ContactForm",
        targetId: id,
        details: { status, senderEmail: message.email },
        ipAddress: req.ip,
      });
    }

    res.status(200).json({
      success: true,
      message: "Contact message status updated.",
      data: message,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Newsletter ──────────────────────────────────────────────────────────────

// 4. Subscribe to Newsletter (Public)
export const subscribeNewsletter = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const validationResult = newsletterSubscribeSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const email = validationResult.data.email.toLowerCase().trim();

    let subscriber = await Newsletter.findOne({ email });
    if (subscriber) {
      if (subscriber.isActive) {
        res.status(200).json({
          success: true,
          message: "You are already subscribed to our newsletter.",
        });
        return;
      }
      subscriber.isActive = true;
      subscriber.unsubscribedAt = undefined;
      await subscriber.save();
    } else {
      subscriber = await Newsletter.create({ email });
    }

    // Send Welcome Email
    try {
      await sendEmail({
        to: email,
        subject: "Welcome to BDSisters.org Newsletter!",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #0f766e;">Assalamu Alaikum!</h2>
            <p>Welcome to the <strong>BDSisters.org</strong> community newsletter.</p>
            <p>You will receive our updates, community events, sister entrepreneur highlights, and developmental resources directly to your inbox.</p>
            <br/>
            <p>Jazakallahu Khairan for joining us!</p>
            <p>Team BDSisters.org</p>
          </div>
        `,
        text: "Assalamu Alaikum! Welcome to the BDSisters.org community newsletter. You will receive our updates, sister entrepreneur highlights, and community resources.",
      });
    } catch (emailErr) {
      console.error("Failed to send newsletter welcome email:", (emailErr as Error).message);
    }

    res.status(201).json({
      success: true,
      message: "Subscribed to newsletter successfully! Please check your email inbox.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 5. Unsubscribe from Newsletter (Public)
export const unsubscribeNewsletter = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const validationResult = newsletterSubscribeSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const email = validationResult.data.email.toLowerCase().trim();
    const subscriber = await Newsletter.findOne({ email });

    if (subscriber) {
      subscriber.isActive = false;
      subscriber.unsubscribedAt = new Date();
      await subscriber.save();
    }

    res.status(200).json({
      success: true,
      message: "You have been unsubscribed from our newsletter.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 6. Get All Newsletter Subscribers (Admin)
export const getNewsletterSubscribers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (req.query.activeOnly === "true") filter.isActive = true;

    const [subscribers, total] = await Promise.all([
      Newsletter.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Newsletter.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: subscribers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
