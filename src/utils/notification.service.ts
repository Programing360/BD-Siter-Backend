import { Types } from "mongoose";
import { Notification, INotification } from "../models/Notification.model";
import { User } from "../models/User.model";
import { sendEmail } from "./sendEmail";

export interface CreateNotificationParams {
  recipientId: Types.ObjectId | string;
  senderId?: Types.ObjectId | string;
  type: "Profile" | "Business" | "Order" | "Forum" | "System";
  title: string;
  message: string;
  link?: string;
  sendEmailNotification?: boolean;
  emailSubject?: string;
  emailHtml?: string;
}

export const createNotification = async (
  params: CreateNotificationParams
): Promise<INotification> => {
  const notification = await Notification.create({
    recipientId: params.recipientId,
    senderId: params.senderId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link,
  });

  // If email notification is requested, fetch user email and send
  if (params.sendEmailNotification) {
    try {
      const user = await User.findById(params.recipientId);
      if (user && user.email) {
        await sendEmail({
          to: user.email,
          subject: params.emailSubject || params.title,
          html:
            params.emailHtml ||
            `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #0f766e;">Assalamu Alaikum, ${user.fullName}!</h2>
              <p>${params.message}</p>
              ${
                params.link
                  ? `<div style="margin-top: 20px;"><a href="${params.link}" style="background-color: #0f766e; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Details</a></div>`
                  : ""
              }
              <br/>
              <p>Team BDSisters.org</p>
            </div>
          `,
          text: params.message,
        });
      }
    } catch (emailError) {
      console.error(
        "Failed to send email notification:",
        (emailError as Error).message
      );
    }
  }

  return notification;
};
