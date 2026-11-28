import { Request, Response } from "express";
import mongoose from "mongoose";
import axios from "axios";
import { Business } from "../models/Business.model";
import { User } from "../models/User.model";
import { Order } from "../models/Order.model";
import { Event } from "../models/Event.model";
import { Payment, IPayment } from "../models/Payment.model";
import { Cart } from "../models/Cart.model";
import { sendEmail } from "../utils/sendEmail";
import { createNotification } from "../utils/notification.service";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// Helper to extract string from string | string[] | undefined
const getParam = (param: unknown): string => {
  if (Array.isArray(param)) return String(param[0]);
  return typeof param === "string" ? param : "";
};

// Helper to resolve clean frontend redirect path by paymentType
const getFrontendReturnUrl = (
  frontendUrl: string,
  paymentType?: string,
): string => {
  const base = frontendUrl.replace(/\/+$/, "");
  switch (paymentType) {
    case "PaidMembership":
      return `${base}/member/billing`;
    case "Order":
      return `${base}/member/orders`;
    case "EventTicket":
      return `${base}/member/events`;
    case "BusinessSubscription":
      return `${base}/member/business`;
    default:
      return `${base}/member/billing`;
  }
};

// Safe wrapper for email dispatch so SMTP/Resend failures never crash payment flows
const sendPaymentEmailSafe = async (options: {
  to?: string;
  email?: string;
  subject: string;
  html: string;
  text?: string;
  message?: string;
}): Promise<void> => {
  try {
    await sendEmail({
      to: options.to || options.email,
      email: options.to || options.email,
      subject: options.subject,
      html: options.html,
      text: options.text || options.message,
      message: options.text || options.message,
    });
  } catch (emailErr) {
    console.warn(
      "⚠️ Non-fatal: Payment confirmation email dispatch failed:",
      (emailErr as Error).message,
    );
  }
};

// Safe wrapper for in-app notification creation
const createNotificationSafe = async (
  notificationData: Parameters<typeof createNotification>[0],
): Promise<void> => {
  try {
    await createNotification(notificationData);
  } catch (notifErr) {
    console.warn(
      "⚠️ Non-fatal: Notification creation failed:",
      (notifErr as Error).message,
    );
  }
};

// ─── Reusable Payment Fulfillment (Idempotent) ───────────────────────────────
export const fulfillPayment = async (
  payment: IPayment,
  gatewayResponse?: Record<string, any>,
): Promise<void> => {
  if (payment.status === "Success") {
    return;
  }

  payment.status = "Success";
  payment.paidAt = new Date();
  if (gatewayResponse) {
    payment.gatewayResponse = gatewayResponse;
  }
  await payment.save();

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  // 1. Business Subscription Fulfillment
  if (payment.paymentType === "BusinessSubscription") {
    const business = await Business.findById(payment.referenceId);
    if (business) {
      business.subscriptionStatus = "Paid";
      business.brands.forEach((brand) => {
        brand.isPublished = true;
      });
      business.subscriptionHistory.push({
        status: "Paid",
        paidAt: new Date(),
        amount: payment.amount,
        transactionId: payment.transactionId,
      });
      await business.save();
    }

    const user = await User.findById(payment.userId);
    if (user && user.email) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #5B9891;">Assalamu Alaikum, ${user.fullName}!</h2>
          <p>Your payment for <strong>BDSisters.org Business Subscription</strong> via ZiniPay has been successfully processed.</p>
          <p>Transaction ID: <strong>${payment.transactionId}</strong></p>
          ${payment.invoiceId ? `<p>Invoice ID: <strong>${payment.invoiceId}</strong></p>` : ""}
          <p>Amount: <strong>${payment.amount} BDT</strong></p>
          <p>All your registered brands have been published successfully.</p>
          <br/>
          <p>Jazakallahu Khairan for staying with us!</p>
          <p><strong>Team BDSisters.org</strong></p>
        </div>
      `;

      await sendPaymentEmailSafe({
        email: user.email,
        subject: "Business Subscription Payment Successful - BDSisters.org",
        message:
          "Your payment was successful and your business subscription is now active.",
        html: emailHtml,
      });

      await createNotificationSafe({
        recipientId: payment.userId,
        type: "Business",
        title: "Business Subscription Activated! 🚀",
        message: `Your payment of ${payment.amount} BDT via ZiniPay was successful. All registered brands are now published.`,
        link: `${frontendUrl}/member/business`,
      });
    }
  }

  // 2. E-Commerce Order Fulfillment
  else if (payment.paymentType === "Order") {
    const order = await Order.findById(payment.referenceId);
    if (order) {
      order.paymentStatus = "Paid";
      order.orderStatus = "Processing";
      order.transactionId = payment.transactionId;
      await order.save();
    }

    // Clear user's shopping cart in MongoDB upon confirmed payment
    try {
      await Cart.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(payment.userId) },
        { items: [] }
      );
    } catch (cartErr) {
      console.warn("Cart clear after payment fulfillment error:", cartErr);
    }

    const user = await User.findById(payment.userId);
    if (user && user.email) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #5B9891;">Assalamu Alaikum, ${user.fullName}!</h2>
          <p>Your order payment of <strong>${payment.amount} BDT</strong> via ZiniPay has been successfully processed.</p>
          <p>Order ID: <strong>${payment.referenceId}</strong></p>
          <p>Transaction ID: <strong>${payment.transactionId}</strong></p>
          ${payment.invoiceId ? `<p>Invoice ID: <strong>${payment.invoiceId}</strong></p>` : ""}
          <p>Our seller sisters have received your order and are preparing it for delivery.</p>
          <br/>
          <p>Jazakallahu Khairan for shopping with BDSisters.org!</p>
          <p><strong>Team BDSisters.org</strong></p>
        </div>
      `;

      await sendPaymentEmailSafe({
        email: user.email,
        subject: "Order Payment Successful - BDSisters.org",
        message:
          "Your payment for order " + payment.referenceId + " was successful.",
        html: emailHtml,
      });

      await createNotificationSafe({
        recipientId: payment.userId,
        type: "Order",
        title: "Order Payment Confirmed! 🛍️",
        message: `Your payment of ${payment.amount} BDT for order #${payment.referenceId.slice(-6)} has been verified.`,
        link: `${frontendUrl}/member/orders`,
      });
    }
  }

  // 3. Event Ticket Fulfillment
  else if (payment.paymentType === "EventTicket") {
    const event = await Event.findById(payment.referenceId);
    if (event) {
      const alreadyRegistered = event.registeredAttendees.some(
        (id) => id.toString() === payment.userId.toString(),
      );
      if (!alreadyRegistered) {
        event.registeredAttendees.push(payment.userId as any);
        await event.save();
      }
    }

    const user = await User.findById(payment.userId);
    if (user && user.email && event) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #5B9891;">Assalamu Alaikum, ${user.fullName}!</h2>
          <p>Your event ticket booking for <strong>${event.title}</strong> has been confirmed.</p>
          <p>Transaction ID: <strong>${payment.transactionId}</strong></p>
          <p>Ticket Amount: <strong>${payment.amount} BDT</strong></p>
          <p>Date & Time: <strong>${new Date(event.date).toLocaleDateString()} at ${event.time}</strong></p>
          <p>Location/Meeting Info: <strong>${event.locationDetails}</strong></p>
          <br/>
          <p>Jazakallahu Khairan for joining our sisterhood events!</p>
          <p><strong>Team BDSisters.org</strong></p>
        </div>
      `;

      await sendPaymentEmailSafe({
        email: user.email,
        subject: `Ticket Confirmed: ${event.title} - BDSisters.org`,
        message: `Your event ticket for ${event.title} was confirmed.`,
        html: emailHtml,
      });

      await createNotificationSafe({
        recipientId: payment.userId,
        type: "System",
        title: "Event Ticket Confirmed! 🎟️",
        message: `Your ticket for "${event.title}" has been confirmed. See event details in your dashboard.`,
        link: `${frontendUrl}/member/events`,
      });
    }
  }

  // 4. Paid Membership Fulfillment
  else if (payment.paymentType === "PaidMembership") {
    const targetUserId = payment.referenceId || payment.userId;
    const user = await User.findById(targetUserId);
    if (user) {
      if (user.role !== "Admin" && user.role !== "SuperAdmin") {
        user.role = "PaidMember";
        await user.save();
      }

      if (user.email) {
        const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #5B9891;">Assalamu Alaikum, ${user.fullName}!</h2>
          <p>Congratulations! Your upgrade to <strong>Paid Sisterhood Membership</strong> on BDSisters.org has been confirmed.</p>
          <p>Transaction ID: <strong>${payment.transactionId}</strong></p>
          <p>Amount: <strong>${payment.amount} BDT</strong></p>
          ${payment.invoiceId ? `<p>Invoice ID: <strong>${payment.invoiceId}</strong></p>` : ""}
          <p>You now have full access to exclusive resources, priority event booking, and member-only sisterhood circles.</p>
          <br/>
          <p>Jazakallahu Khairan for supporting BDSisters.org!</p>
          <p><strong>Team BDSisters.org</strong></p>
        </div>
      `;

        await sendPaymentEmailSafe({
          email: user.email,
          subject: "Paid Membership Confirmed - BDSisters.org",
          message: `Your payment of ${payment.amount} BDT for Paid Membership upgrade was successful.`,
          html: emailHtml,
        });
      }

      await createNotificationSafe({
        recipientId: user._id as any,
        type: "System",
        title: "Paid Membership Active! 🌟",
        message: `Assalamu Alaikum! Your Paid Membership is now active. Enjoy premium features and sisterhood perks.`,
        link: `${frontendUrl}/member/billing`,
      });
    }
  }
};

// ─── 1. Initiate ZiniPay Payment (POST /api/payment/zinipay/init) ─────────────
export const initZiniPayPayment = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const {
      paymentType = "BusinessSubscription",
      businessId,
      orderId,
      eventId,
      totalAmount,
      customerName,
      customerEmail,
      customerPhone,
      currency = "BDT",
    } = req.body;

    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User authentication or userId is required.",
      });
      return;
    }

    // Resolve reference ID based on payment type
    let referenceId = "";
    if (paymentType === "Order") {
      referenceId = (orderId || req.body.referenceId) as string;
    } else if (paymentType === "EventTicket") {
      referenceId = (eventId || req.body.referenceId) as string;
    } else if (paymentType === "PaidMembership") {
      referenceId = (req.body.referenceId || userId) as string;
    } else {
      referenceId = (businessId || req.body.referenceId) as string;
      if (!referenceId && userId && mongoose.Types.ObjectId.isValid(userId)) {
        const userBiz = await Business.findOne({ userId });
        if (userBiz) {
          referenceId = userBiz._id.toString();
        }
      }
    }

    if (!referenceId || !mongoose.Types.ObjectId.isValid(referenceId)) {
      res.status(400).json({
        success: false,
        message: `Valid reference ID required for ${paymentType} payment.`,
      });
      return;
    }

    let customerNameResolved = customerName;
    let customerEmailResolved = customerEmail;
    let customerPhoneResolved = customerPhone;

    // Verify entity existence
    if (paymentType === "Order") {
      const order = await Order.findById(referenceId);
      if (!order) {
        res.status(404).json({ success: false, message: "Order not found." });
        return;
      }
    } else if (paymentType === "EventTicket") {
      const event = await Event.findById(referenceId);
      if (!event) {
        res.status(404).json({ success: false, message: "Event not found." });
        return;
      }
      if (event.isCancelled) {
        res
          .status(400)
          .json({ success: false, message: "This event has been cancelled." });
        return;
      }
    } else if (paymentType === "PaidMembership") {
      const targetUser = await User.findById(referenceId);
      if (!targetUser) {
        res
          .status(404)
          .json({ success: false, message: "User account not found." });
        return;
      }
      if (!customerNameResolved) customerNameResolved = targetUser.fullName;
      if (!customerEmailResolved) customerEmailResolved = targetUser.email;
      if (!customerPhoneResolved && targetUser.contactInfo?.phone) {
        customerPhoneResolved = targetUser.contactInfo.phone;
      }
    } else {
      const business = await Business.findById(referenceId);
      if (!business) {
        res
          .status(404)
          .json({ success: false, message: "Business profile not found." });
        return;
      }
    }

    const amount = Number(totalAmount || req.body.amount);
    if (!amount || amount <= 0) {
      res
        .status(400)
        .json({ success: false, message: "Valid amount is required." });
      return;
    }

    const transId = `TRAN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const backendUrl = (
      process.env.BACKEND_URL || "http://localhost:5000"
    ).replace(/\/+$/, "");
    let rawBaseUrl = (
      process.env.ZINIPAY_BASE_URL || "https://api.zinipay.com"
    ).trim().replace(/\/+$/, "");
    if (!rawBaseUrl.endsWith("/v1")) {
      rawBaseUrl = `${rawBaseUrl}/v1`;
    }
    const createEndpoint = `${rawBaseUrl}/payment/create`;
    const apiKey = (process.env.ZINIPAY_API_KEY || "").trim();

    // Create pending payment record
    const payment = await Payment.create({
      transactionId: transId,
      gateway: "ZiniPay",
      userId,
      paymentType,
      referenceId,
      amount,
      currency,
      status: "Pending",
    });

    // Require real ZiniPay API key
    if (!apiKey) {
      res.status(500).json({
        success: false,
        message: "Payment gateway is not configured (missing ZINIPAY_API_KEY).",
      });
      return;
    }

    const cusName = customerNameResolved || customerName || "Sister Member";
    const cusEmail =
      customerEmailResolved || customerEmail || "sister@bdsisters.org";
    const cusPhone = customerPhoneResolved || customerPhone || "01700000000";

    const payload = {
      amount,
      currency,
      cus_name: cusName,
      cus_email: cusEmail,
      cus_phone: cusPhone,
      customer_name: cusName,
      customer_email: cusEmail,
      customer_phone: cusPhone,
      redirect_url: `${backendUrl}/api/payment/zinipay/verify?tranId=${transId}`,
      cancel_url: `${backendUrl}/api/payment/zinipay/cancel?tranId=${transId}`,
      webhook_url: `${backendUrl}/api/payment/zinipay/webhook`,
      metadata: {
        transaction_id: transId,
        payment_type: paymentType,
        reference_id: referenceId,
        user_id: userId,
      },
    };

    try {
      const response = await axios.post(createEndpoint, payload, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "zini-api-key": apiKey,
          "zinipay-api-key": apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 15000,
      });

      if (response && response.data) {
        const resData = response.data;
        const paymentUrl =
          resData.payment_url ||
          resData.data?.payment_url ||
          resData.GatewayPageURL ||
          resData.paymentUrl;
        const invoiceId =
          resData.invoice_id ||
          resData.data?.invoice_id ||
          resData.val_id ||
          resData.id;

        if (paymentUrl) {
          payment.invoiceId = invoiceId;
          payment.gatewayResponse = resData;
          await payment.save();

          res.status(200).json({
            success: true,
            gateway: "ZiniPay",
            paymentUrl,
            invoiceId,
            transId,
          });
          return;
        }
      }

      throw new Error(
        response.data?.message ||
        "Failed to receive valid payment URL from ZiniPay.",
      );
    } catch (apiErr: any) {
      const errData = apiErr.response?.data;
      const errStatus = apiErr.response?.status || 400;
      const errMsg =
        errData?.message ||
        errData?.msg ||
        (typeof errData === "string" ? errData : null) ||
        apiErr.message ||
        "ZiniPay gateway error";

      console.error("ZiniPay initiation error:", {
        status: errStatus,
        data: errData,
        message: errMsg,
      });

      payment.status = "Failed";
      payment.gatewayResponse = errData || { error: errMsg };
      await payment.save();

      res
        .status(errStatus >= 400 && errStatus < 500 ? errStatus : 400)
        .json({
          success: false,
          gateway: "ZiniPay",
          message: errMsg.startsWith("ZiniPay")
            ? errMsg
            : `ZiniPay Error: ${errMsg}`,
          error: errData,
        });
      return;
    }
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 2. ZiniPay Verify / Redirect Handler (POST & GET /api/payment/zinipay/verify)
export const verifyZiniPayPayment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  try {
    const query = (req.query || {}) as Record<string, any>;
    const body = (req.body || {}) as Record<string, any>;

    const tranId =
      getParam(query.tranId) ||
      getParam(body.tran_id) ||
      getParam(body.transaction_id) ||
      getParam(query.transaction_id);

    const invoiceId =
      getParam(query.invoice_id) ||
      getParam(body.invoice_id) ||
      getParam(query.invoiceId) ||
      getParam(body.invoiceId);

    const statusParam = (
      getParam(query.status) ||
      getParam(body.status) ||
      ""
    ).toUpperCase();

    let payment = tranId
      ? await Payment.findOne({ transactionId: tranId })
      : null;

    if (!payment && invoiceId) {
      payment = await Payment.findOne({ invoiceId });
    }

    if (!payment) {
      res.redirect(
        `${frontendUrl.replace(/\/+$/, "")}/member/billing?payment=not_found&tranId=${encodeURIComponent(tranId || "")}`,
      );
      return;
    }

    const returnUrl = getFrontendReturnUrl(frontendUrl, payment.paymentType);

    // Check with ZiniPay verify API if invoice ID is available
    let isVerifiedSuccess =
      statusParam === "COMPLETED" ||
      statusParam === "PAID" ||
      statusParam === "SUCCESS";

    let rawBaseUrl = (
      process.env.ZINIPAY_BASE_URL || "https://api.zinipay.com"
    ).trim().replace(/\/+$/, "");
    if (!rawBaseUrl.endsWith("/v1")) {
      rawBaseUrl = `${rawBaseUrl}/v1`;
    }
    const verifyEndpoint = `${rawBaseUrl}/payment/verify`;
    const apiKey = (process.env.ZINIPAY_API_KEY || "").trim();

    if (
      !isVerifiedSuccess &&
      apiKey &&
      apiKey !== "sandbox_test_key" &&
      (payment.invoiceId || invoiceId)
    ) {
      try {
        const verifyRes = await axios.post(
          verifyEndpoint,
          { invoice_id: payment.invoiceId || invoiceId },
          {
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              "zini-api-key": apiKey,
              "zinipay-api-key": apiKey,
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: 8000,
          },
        );

        const vStatus = (
          verifyRes.data?.status ||
          verifyRes.data?.data?.status ||
          ""
        ).toUpperCase();

        if (
          vStatus === "COMPLETED" ||
          vStatus === "PAID" ||
          vStatus === "SUCCESS"
        ) {
          isVerifiedSuccess = true;
          payment.gatewayResponse = verifyRes.data;
        }
      } catch (vErr: any) {
        console.error("ZiniPay verification call error:", {
          status: vErr.response?.status,
          data: vErr.response?.data,
          message: vErr.message,
        });
      }
    }

    // Verified or sandbox success -> Fulfill & redirect cleanly to Next.js frontend
    if (isVerifiedSuccess || statusParam === "COMPLETED") {
      await fulfillPayment(payment, { ...query, ...body });
      res.redirect(
        `${returnUrl}?payment=success&tranId=${encodeURIComponent(payment.transactionId)}`,
      );
      return;
    }

    // Cancelled -> Redirect cleanly to Next.js frontend
    if (statusParam === "CANCELLED") {
      payment.status = "Cancelled";
      await payment.save();
      const cancelReturnUrl =
        payment.paymentType === "Order"
          ? `${frontendUrl.replace(/\/+$/, "")}/checkout`
          : returnUrl;
      res.redirect(
        `${cancelReturnUrl}?payment=cancelled&tranId=${encodeURIComponent(payment.transactionId)}`,
      );
      return;
    }

    // Failed -> Redirect cleanly to Next.js frontend
    payment.status = "Failed";
    await payment.save();
    res.redirect(
      `${returnUrl}?payment=failed&tranId=${encodeURIComponent(payment.transactionId)}`,
    );
  } catch (error) {
    console.error("Payment verification fatal error:", error);
    res.redirect(
      `${frontendUrl.replace(/\/+$/, "")}/member/billing?payment=error&message=${encodeURIComponent((error as Error).message || "Verification failed")}`,
    );
  }
};

// ─── 3. ZiniPay Webhook / IPN Listener (POST /api/payment/zinipay/webhook) ───
export const ziniPayWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const payload = req.body || {};
    const invoiceId = getParam(payload.invoice_id) || getParam(payload.id);
    const tranId =
      getParam(payload.transaction_id) ||
      getParam(payload.metadata?.transaction_id);
    const rawStatus = (
      getParam(payload.status) || getParam(payload.payment_status)
    ).toUpperCase();

    if (!invoiceId && !tranId) {
      res.status(400).json({
        success: false,
        message: "Missing invoice_id or transaction_id in webhook payload.",
      });
      return;
    }

    let payment = tranId
      ? await Payment.findOne({ transactionId: tranId })
      : null;

    if (!payment && invoiceId) {
      payment = await Payment.findOne({ invoiceId });
    }

    if (!payment) {
      res
        .status(404)
        .json({ success: false, message: "Payment record not found." });
      return;
    }

    payment.ipnPayload = payload;

    if (
      rawStatus === "COMPLETED" ||
      rawStatus === "PAID" ||
      rawStatus === "SUCCESS" ||
      rawStatus === "VALID" ||
      rawStatus === "VALIDATED"
    ) {
      await fulfillPayment(payment, payload);
    } else if (rawStatus === "FAILED") {
      payment.status = "Failed";
      if (payment.paymentType === "Order") {
        await Order.findByIdAndUpdate(payment.referenceId, {
          paymentStatus: "Failed",
        });
      }
    } else if (rawStatus === "CANCELLED") {
      payment.status = "Cancelled";
      if (payment.paymentType === "Order") {
        await Order.findByIdAndUpdate(payment.referenceId, {
          paymentStatus: "Cancelled",
        });
      }
    }

    await payment.save();
    res
      .status(200)
      .json({ success: true, message: "ZiniPay webhook processed." });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 4. ZiniPay Cancel Handler ───────────────────────────────────────────────
export const ziniPayCancel = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const query = (req.query || {}) as Record<string, any>;
    const body = (req.body || {}) as Record<string, any>;

    const tranId =
      getParam(query.tranId) ||
      getParam(body.tran_id) ||
      getParam(query.transaction_id) ||
      getParam(body.transaction_id);

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    let returnUrl = `${frontendUrl.replace(/\/+$/, "")}/member/billing`;

    if (tranId) {
      const payment = await Payment.findOne({ transactionId: tranId });
      if (payment) {
        returnUrl =
          payment.paymentType === "Order"
            ? `${frontendUrl.replace(/\/+$/, "")}/checkout`
            : getFrontendReturnUrl(frontendUrl, payment.paymentType);
        if (payment.status !== "Success") {
          payment.status = "Cancelled";
          payment.gatewayResponse = { ...query, ...body };
          await payment.save();

          if (payment.paymentType === "Order") {
            await Order.findByIdAndUpdate(payment.referenceId, {
              paymentStatus: "Cancelled",
            });
          }
        }
      }
    }

    res.redirect(
      `${returnUrl}?payment=cancelled&tranId=${encodeURIComponent(tranId || "")}`,
    );
  } catch (error) {
    console.error("Payment cancel fatal error:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(
      `${frontendUrl.replace(/\/+$/, "")}/member/billing?payment=cancelled`,
    );
  }
};

// ─── 5. User Invoices History (GET /api/payment/invoices & /api/payment/zinipay/invoices) ──
export const getUserInvoices = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id || (req.user as any)?._id;
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    const invoices = await Payment.find({
      $or: [
        { userId: userId as any },
        ...(mongoose.Types.ObjectId.isValid(userId)
          ? [{ userId: new mongoose.Types.ObjectId(userId) as any }]
          : []),
      ],
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: invoices,
      count: invoices.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Aliases for backwards compatibility ─────────────────────────────────────
export const initPayment = initZiniPayPayment;
export const paymentSuccess = verifyZiniPayPayment;
export const paymentFail = verifyZiniPayPayment;
export const paymentCancel = ziniPayCancel;
export const paymentIpn = ziniPayWebhook;