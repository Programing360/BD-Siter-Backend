import nodemailer, { Transporter } from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

let transporter: Transporter | null = null;

const getTransporter = (): Transporter | null => {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS;

  if (!user || !pass) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  return transporter;
};

const FROM_EMAIL =
  process.env.FROM_EMAIL ||
  process.env.SMTP_USER ||
  process.env.GMAIL_USER ||
  "no-reply@bdsisters.org";

const APP_NAME = process.env.APP_NAME || "BDSisters.org";

export interface EmailOptions {
  to?: string;
  email?: string;
  subject: string;
  html: string;
  text?: string;
  message?: string;
}

/**
 * Send an email via Nodemailer (Gmail SMTP) or log safely in dev/mock environment.
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  const recipient = options.to || options.email;
  if (!recipient) {
    throw new Error("Email recipient is required.");
  }

  const transport = getTransporter();
  if (!transport) {
    console.log(
      `\n=======================================================\n` +
      `[SMTP Notice] SMTP_USER or SMTP_PASS not set in .env.\n` +
      `[Email Mock] To: ${recipient}\n` +
      `[Subject]: ${options.subject}\n` +
      `[Body]: ${options.text || options.message || "HTML Email"}\n` +
      `=======================================================\n`
    );
    return;
  }

  try {
    const info = await transport.sendMail({
      from: `"${APP_NAME}" <${FROM_EMAIL}>`,
      to: recipient,
      subject: options.subject,
      html: options.html,
      text: options.text || options.message,
    });
    console.log(`[Email Delivered] Message sent to ${recipient} (Message ID: ${info.messageId})`);
  } catch (err: any) {
    console.error(`Email delivery to ${recipient} failed:`, err?.message || err);
    throw new Error(`Email sending failed: ${err?.message || "Unknown SMTP error"}`);
  }
};

// ─── Reusable Email Templates ─────────────────────────────────────────────────

export const emailTemplates = {
  /**
   * 6-Digit OTP Email Verification template.
   */
  verifyOtp(fullName: string, otp: string): EmailOptions {
    return {
      to: "",
      subject: `${otp} is your BDSisters.org Verification Code`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background-color: #FAF8F5; padding: 32px 20px; color: #111E28;">
          <div style="background-color: #ffffff; border-radius: 16px; border: 1px solid #E8ECEF; padding: 36px 28px; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
            
            <!-- Header Brand -->
            <div style="text-align: center; margin-bottom: 28px;">
              <span style="font-size: 24px; font-weight: 800; color: #5B9891; letter-spacing: -0.5px;">BDSisters<span style="color: #D98408;">.org</span></span>
              <p style="font-size: 13px; color: #64748B; margin-top: 4px; font-weight: 500;">Women Entrepreneurship & Professional Sisterhood</p>
            </div>

            <!-- Greeting -->
            <h2 style="font-size: 20px; font-weight: 700; color: #111E28; margin-top: 0; margin-bottom: 12px;">Assalamu Alaikum, ${fullName}!</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
              Thank you for registering with BDSisters. Please use the 6-digit verification code below to verify your email address and activate your account.
            </p>

            <!-- OTP Highlight Box -->
            <div style="background: linear-gradient(135deg, #FAF8F5 0%, #F7DFC7 100%); border: 1.5px dashed #D98408; border-radius: 12px; padding: 24px 16px; text-align: center; margin: 24px 0;">
              <div style="font-size: 12px; font-weight: 700; color: #D98408; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                Your 6-Digit Verification Code
              </div>
              <div style="font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #111E28; font-family: monospace;">
                ${otp}
              </div>
              <p style="font-size: 12px; color: #64748B; margin: 8px 0 0 0;">
                Valid for <strong>10 minutes</strong>. Do not share this code with anyone.
              </p>
            </div>

            <p style="font-size: 13px; line-height: 1.6; color: #64748B; margin: 20px 0 0 0;">
              If you did not initiate this registration, please disregard this email.
            </p>

            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 28px 0 20px 0;" />

            <!-- Footer -->
            <div style="text-align: center; font-size: 12px; color: #94A3B8;">
              <p style="margin: 0 0 4px 0;">Sisterhood • Integrity • Economic Empowerment</p>
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} BDSisters.org. All rights reserved.</p>
            </div>
          </div>
        </div>
      `,
      text: `Assalamu Alaikum ${fullName}. Your BDSisters verification code is ${otp}. It is valid for 10 minutes.`,
    };
  },

  /**
   * Email verification link email (maintained for legacy compatibility).
   */
  verifyEmail(fullName: string, verifyUrl: string): EmailOptions {
    return {
      to: "",
      subject: `Verify your BDSisters.org account`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#333">
          <h2 style="color:#5B9891">Assalamu Alaikum, ${fullName}!</h2>
          <p>Thank you for registering with <strong>BDSisters.org</strong>.</p>
          <p>Please verify your email address by clicking the button below:</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${verifyUrl}" style="background:#5B9891;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">
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
          <h2 style="color:#5B9891">Assalamu Alaikum, ${fullName}!</h2>
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
          <h2 style="color:#5B9891">Assalamu Alaikum, ${fullName}!</h2>
          <p>Great news! Your <strong>BDSisters.org</strong> account has been reviewed and approved by our admin team.</p>
          <p>You can now log in and access all member features.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${dashboardUrl}" style="background:#5B9891;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">
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
          <h2 style="color:#5B9891">Assalamu Alaikum, ${fullName}!</h2>
          <p>Your payment for <strong>BDSisters.org Business Subscription</strong> has been successfully processed.</p>
          <p>All your registered brands have been published successfully.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${dashboardUrl}" style="background:#5B9891;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">
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
