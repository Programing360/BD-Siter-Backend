import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

let resendClient: Resend | null = null;

const getResendClient = (): Resend | null => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      "⚠️ RESEND_API_KEY is missing or empty in .env. Email dispatch will be mocked.",
    );
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
};

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "no-reply@bdsisters.org";

const APP_NAME = "BDSisters.org";

export interface EmailOptions {
  to?: string;
  email?: string;
  subject: string;
  html: string;
  text?: string;
  message?: string;
}

/**
 * Send an email via the Resend API.
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  const recipient = options.to || options.email;
  if (!recipient) {
    throw new Error("Email recipient is required.");
  }

  const client = getResendClient();
  if (!client) {
    console.log(`[Email Mock] To: ${recipient} | Subject: ${options.subject}`);
    return;
  }

  const { error } = await client.emails.send({
    from: `${APP_NAME} <${FROM_EMAIL}>`,
    to: recipient,
    subject: options.subject,
    html: options.html,
    text: options.text || options.message,
  });

  if (error) {
    console.error(`Email delivery to ${recipient} failed:`, error.message);
    throw new Error(`Email sending failed: ${error.message}`);
  }
};

// ─── Reusable Email Templates ─────────────────────────────────────────────────

export const emailTemplates = {
  /**
   * Email verification link email.
   */
  verifyEmail(fullName: string, verifyUrl: string): EmailOptions {
    return {
      to: "", // caller sets `to`
      subject: `Verify your BDSisters.org account`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#333">
          <h2 style="color:#0f766e">Assalamu Alaikum, ${fullName}!</h2>
          <p>Thank you for registering with <strong>BDSisters.org</strong>.</p>
          <p>Please verify your email address by clicking the button below. This link expires in <strong>24 hours</strong>.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${verifyUrl}" style="background:#0f766e;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">
              Verify Email Address
            </a>
          </div>
          <p style="color:#666;font-size:13px">If you did not create an account, please ignore this email.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="color:#999;font-size:12px">Team BDSisters.org</p>
        </div>
      `,
      text: `Verify your email: ${verifyUrl}`,
    };
  },

  /**
   * Password reset link email.
   */
  resetPassword(fullName: string, resetUrl: string): EmailOptions {
    return {
      to: "",
      subject: `Reset your BDSisters.org password`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#333">
          <h2 style="color:#0f766e">Assalamu Alaikum, ${fullName}!</h2>
          <p>We received a request to reset your password on <strong>BDSisters.org</strong>.</p>
          <p>Click the button below to reset it. This link expires in <strong>1 hour</strong>.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${resetUrl}" style="background:#dc2626;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">
              Reset Password
            </a>
          </div>
          <p style="color:#666;font-size:13px">If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="color:#999;font-size:12px">Team BDSisters.org</p>
        </div>
      `,
      text: `Reset your password: ${resetUrl}`,
    };
  },

  /**
   * Account approved notification email.
   */
  accountApproved(fullName: string, dashboardUrl: string): EmailOptions {
    return {
      to: "",
      subject: `Your BDSisters.org account has been approved! 🎉`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#333">
          <h2 style="color:#0f766e">Assalamu Alaikum, ${fullName}!</h2>
          <p>Great news! Your <strong>BDSisters.org</strong> account has been reviewed and approved by our admin team.</p>
          <p>You can now log in and access all member features.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${dashboardUrl}" style="background:#0f766e;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">
              Go to Dashboard
            </a>
          </div>
          <p>Jazakallahu Khairan for joining our community!</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="color:#999;font-size:12px">Team BDSisters.org</p>
        </div>
      `,
      text: `Your account is approved! Visit: ${dashboardUrl}`,
    };
  },

  /**
   * Business subscription payment confirmation email.
   */
  paymentSuccess(fullName: string, dashboardUrl: string): EmailOptions {
    return {
      to: "",
      subject: `Payment Successful — BDSisters.org Business Subscription`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#333">
          <h2 style="color:#0f766e">Assalamu Alaikum, ${fullName}!</h2>
          <p>Your payment for <strong>BDSisters.org Business Subscription</strong> has been successfully processed.</p>
          <p>All your registered brands have been published successfully.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${dashboardUrl}" style="background:#0f766e;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">
              View My Business Profile
            </a>
          </div>
          <p>Jazakallahu Khairan for staying with us!</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="color:#999;font-size:12px">Team BDSisters.org</p>
        </div>
      `,
      text: `Payment successful! Visit your dashboard: ${dashboardUrl}`,
    };
  },
};
