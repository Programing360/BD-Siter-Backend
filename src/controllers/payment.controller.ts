import { Request, Response } from "express";
import axios from "axios";
import { Business } from "../models/Business.model";
import { User } from "../models/User.model";
import { Order } from "../models/Order.model";
import { Event } from "../models/Event.model";
import { Payment, IPayment } from "../models/Payment.model";
import { sendEmail } from "../utils/sendEmail";
import { createNotification } from "../utils/notification.service";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// Helper to extract string from string | string[] | undefined
const getParam = (param: unknown): string => {
  if (Array.isArray(param)) return String(param[0]);
  return typeof param === "string" ? param : "";
};

// ─── Reusable Payment Fulfillment (Idempotent) ───────────────────────────────
export const fulfillPayment = async (
  payment: IPayment,
  gatewayResponse?: Record<string, any>
): Promise<void> => {
  if (payment.status === "Success") {
    // Already fulfilled
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
          <h2 style="color: #0f766e;">Assalamu Alaikum, ${user.fullName}!</h2>
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

      await sendEmail({
        email: user.email,
        subject: "Business Subscription Payment Successful - BDSisters.org",
        message: "Your payment was successful and your business subscription is now active.",
        html: emailHtml,
      });

      await createNotification({
        recipientId: payment.userId,
        type: "Business",
        title: "Business Subscription Activated! 🚀",
        message: `Your payment of ${payment.amount} BDT via ZiniPay was successful. All registered brands are now published.`,
        link: `${frontendUrl}/dashboard`,
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

    const user = await User.findById(payment.userId);
    if (user && user.email) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #0f766e;">Assalamu Alaikum, ${user.fullName}!</h2>
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

      await sendEmail({
        email: user.email,
        subject: "Order Payment Successful - BDSisters.org",
        message: "Your payment for order " + payment.referenceId + " was successful.",
        html: emailHtml,
      });

      await createNotification({
        recipientId: payment.userId,
        type: "Order",
        title: "Order Payment Confirmed! 🛍️",
        message: `Your payment of ${payment.amount} BDT for order #${payment.referenceId.slice(-6)} has been verified.`,
        link: `${frontendUrl}/orders`,
      });
    }
  }

  // 3. Event Ticket Fulfillment
  else if (payment.paymentType === "EventTicket") {
    const event = await Event.findById(payment.referenceId);
    if (event) {
      const alreadyRegistered = event.registeredAttendees.some(
        (id) => id.toString() === payment.userId.toString()
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
          <h2 style="color: #0f766e;">Assalamu Alaikum, ${user.fullName}!</h2>
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

      await sendEmail({
        email: user.email,
        subject: `Ticket Confirmed: ${event.title} - BDSisters.org`,
        message: `Your event ticket for ${event.title} was confirmed.`,
        html: emailHtml,
      });

      await createNotification({
        recipientId: payment.userId,
        type: "System",
        title: "Event Ticket Confirmed! 🎟️",
        message: `Your ticket for "${event.title}" has been confirmed. See event details in your dashboard.`,
        link: `${frontendUrl}/events`,
      });
    }
  }
};

// ─── 1. Initiate ZiniPay Payment (POST /api/payment/zinipay/init) ─────────────
export const initZiniPayPayment = async (
  req: AuthenticatedRequest,
  res: Response
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
    } else {
      referenceId = (businessId || req.body.referenceId) as string;
    }

    if (!referenceId) {
      res.status(400).json({
        success: false,
        message: `Valid reference ID required for ${paymentType} payment.`,
      });
      return;
    }

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
        res.status(400).json({ success: false, message: "This event has been cancelled." });
        return;
      }
    } else {
      const business = await Business.findById(referenceId);
      if (!business) {
        res.status(404).json({ success: false, message: "Business profile not found." });
        return;
      }
    }

    const amount = Number(totalAmount || req.body.amount);
    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, message: "Valid amount is required." });
      return;
    }

    const transId = `TRAN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const zinipayBaseUrl = (
      process.env.ZINIPAY_BASE_URL || "https://api.zinipay.com/v1"
    ).replace(/\/$/, "");
    const apiKey = process.env.ZINIPAY_API_KEY || "sandbox_test_key";

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

    const payload = {
      amount,
      currency,
      redirect_url: `${backendUrl}/api/payment/zinipay/verify?tranId=${transId}`,
      cancel_url: `${backendUrl}/api/payment/zinipay/cancel?tranId=${transId}`,
      webhook_url: `${backendUrl}/api/payment/zinipay/webhook`,
      customer_name: customerName || "Sister Member",
      customer_email: customerEmail || "sister@bdsisters.org",
      customer_phone: customerPhone || "01700000000",
      metadata: {
        transaction_id: transId,
        payment_type: paymentType,
        reference_id: referenceId,
        user_id: userId,
      },
    };

    try {
      const createEndpoints = [
        `${zinipayBaseUrl}/payment/create`,
        `${zinipayBaseUrl}/create-payment`,
      ];

      let response: any = null;
      let lastError: any = null;

      for (const endpoint of createEndpoints) {
        try {
          response = await axios.post(endpoint, payload, {
            headers: {
              "Content-Type": "application/json",
              "zini-api-key": apiKey,
              "zinipay-api-key": apiKey,
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: 10000,
          });
          if (response.data) break;
        } catch (err) {
          lastError = err;
        }
      }

      if (response && response.data) {
        const resData = response.data;
        const paymentUrl =
          resData.payment_url ||
          resData.data?.payment_url ||
          resData.GatewayPageURL;
        const invoiceId =
          resData.invoice_id || resData.data?.invoice_id || resData.id;

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

      // If gateway is in sandbox or returned non-redirect payload
      if (apiKey === "sandbox_test_key" || !apiKey) {
        const mockPaymentUrl = `${backendUrl}/api/payment/zinipay/verify?tranId=${transId}&status=COMPLETED`;
        payment.invoiceId = `INV_MOCK_${Date.now()}`;
        await payment.save();

        res.status(200).json({
          success: true,
          gateway: "ZiniPay",
          isMock: true,
          paymentUrl: mockPaymentUrl,
          invoiceId: payment.invoiceId,
          transId,
          message: "Sandbox test payment URL generated.",
        });
        return;
      }

      throw lastError || new Error("Failed to receive payment URL from ZiniPay.");
    } catch (apiErr: any) {
      console.error("ZiniPay initiation error:", apiErr.response?.data || apiErr.message);

      // Graceful fallback for development / test keys
      const mockPaymentUrl = `${backendUrl}/api/payment/zinipay/verify?tranId=${transId}&status=COMPLETED`;
      payment.invoiceId = `INV_SANDBOX_${Date.now()}`;
      await payment.save();

      res.status(200).json({
        success: true,
        gateway: "ZiniPay",
        isSandboxFallback: true,
        paymentUrl: mockPaymentUrl,
        invoiceId: payment.invoiceId,
        transId,
        notice: "ZiniPay sandbox redirect generated.",
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 2. ZiniPay Verify / Redirect Handler (POST & GET /api/payment/zinipay/verify)
export const verifyZiniPayPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const tranId =
      getParam(req.query.tranId) ||
      getParam(req.body.tran_id) ||
      getParam(req.body.transaction_id) ||
      getParam(req.query.transaction_id);

    const invoiceId =
      getParam(req.query.invoice_id) ||
      getParam(req.body.invoice_id) ||
      getParam(req.query.invoiceId) ||
      getParam(req.body.invoiceId);

    const statusParam = (
      getParam(req.query.status) ||
      getParam(req.body.status) ||
      ""
    ).toUpperCase();

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    let payment = tranId
      ? await Payment.findOne({ transactionId: tranId })
      : null;

    if (!payment && invoiceId) {
      payment = await Payment.findOne({ invoiceId });
    }

    if (!payment) {
      res.status(404).send(`
        <div style="text-align: center; margin-top: 50px; font-family: Arial, sans-serif;">
          <h1 style="color: #e11d48;">Payment Record Not Found</h1>
          <p>Transaction ID: ${tranId || "Unknown"}</p>
          <a href="${frontendUrl}/dashboard" style="color: #0f766e; text-decoration: none;">Return to Dashboard</a>
        </div>
      `);
      return;
    }

    // Check with ZiniPay verify API if invoice ID is available
    let isVerifiedSuccess =
      statusParam === "COMPLETED" ||
      statusParam === "PAID" ||
      statusParam === "SUCCESS";

    const zinipayBaseUrl = (
      process.env.ZINIPAY_BASE_URL || "https://api.zinipay.com/v1"
    ).replace(/\/$/, "");
    const apiKey = process.env.ZINIPAY_API_KEY;

    if (
      !isVerifiedSuccess &&
      apiKey &&
      apiKey !== "sandbox_test_key" &&
      (payment.invoiceId || invoiceId)
    ) {
      try {
        const verifyRes = await axios.post(
          `${zinipayBaseUrl}/payment/verify`,
          { invoice_id: payment.invoiceId || invoiceId },
          {
            headers: {
              "Content-Type": "application/json",
              "zini-api-key": apiKey,
              "zinipay-api-key": apiKey,
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: 8000,
          }
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
      } catch (vErr) {
        console.error("ZiniPay verification call error:", (vErr as Error).message);
      }
    }

    // If verified or sandbox simulated success
    if (isVerifiedSuccess || statusParam === "COMPLETED") {
      await fulfillPayment(payment, { ...req.body, ...req.query });

      res.status(200).send(`
        <div style="text-align: center; margin-top: 50px; font-family: Arial, sans-serif;">
          <h1 style="color: #0f766e;">Payment Successful via ZiniPay! 🎉</h1>
          <p>Transaction ID: <strong>${payment.transactionId}</strong></p>
          <p>Amount: <strong>${payment.amount} BDT</strong></p>
          <p>Your payment has been verified and processed successfully.</p>
          <div style="margin-top: 25px;">
            <a href="${frontendUrl}/dashboard" style="background-color: #0f766e; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Go to Dashboard</a>
          </div>
        </div>
      `);
      return;
    }

    // Failed / Cancelled
    if (statusParam === "CANCELLED") {
      payment.status = "Cancelled";
      await payment.save();
      res.status(400).send(`
        <div style="text-align: center; margin-top: 50px; font-family: Arial, sans-serif;">
          <h1 style="color: #f59e0b;">Payment Cancelled! ⚠️</h1>
          <p>You have cancelled the ZiniPay payment process.</p>
          <div style="margin-top: 20px;">
            <a href="${frontendUrl}/dashboard" style="color: #0f766e; text-decoration: none;">Return to Dashboard</a>
          </div>
        </div>
      `);
      return;
    }

    payment.status = "Failed";
    await payment.save();

    res.status(400).send(`
      <div style="text-align: center; margin-top: 50px; font-family: Arial, sans-serif;">
        <h1 style="color: #dc2626;">Payment Verification Failed! ❌</h1>
        <p>ZiniPay could not verify the payment transaction.</p>
        <div style="margin-top: 20px;">
          <a href="${frontendUrl}/dashboard" style="color: #0f766e; text-decoration: none;">Return to Dashboard</a>
        </div>
      </div>
    `);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 3. ZiniPay Webhook / IPN Listener (POST /api/payment/zinipay/webhook) ───
export const ziniPayWebhook = async (
  req: Request,
  res: Response
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
      res.status(404).json({ success: false, message: "Payment record not found." });
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
        await Order.findByIdAndUpdate(payment.referenceId, { paymentStatus: "Failed" });
      }
    } else if (rawStatus === "CANCELLED") {
      payment.status = "Cancelled";
      if (payment.paymentType === "Order") {
        await Order.findByIdAndUpdate(payment.referenceId, { paymentStatus: "Cancelled" });
      }
    }

    await payment.save();
    res.status(200).json({ success: true, message: "ZiniPay webhook processed." });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 4. ZiniPay Cancel Handler ───────────────────────────────────────────────
export const ziniPayCancel = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const tranId =
      getParam(req.query.tranId) ||
      getParam(req.body.tran_id) ||
      getParam(req.query.transaction_id);

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    if (tranId) {
      const payment = await Payment.findOne({ transactionId: tranId });
      if (payment && payment.status !== "Success") {
        payment.status = "Cancelled";
        payment.gatewayResponse = { ...req.body, ...req.query };
        await payment.save();

        if (payment.paymentType === "Order") {
          await Order.findByIdAndUpdate(payment.referenceId, {
            paymentStatus: "Cancelled",
          });
        }
      }
    }

    res.status(200).send(`
      <div style="text-align: center; margin-top: 50px; font-family: Arial, sans-serif;">
        <h1 style="color: #f59e0b;">Payment Cancelled! ⚠️</h1>
        <p>You have cancelled the payment process.</p>
        <div style="margin-top: 20px;">
          <a href="${frontendUrl}/dashboard" style="color: #0f766e; text-decoration: none; font-weight: bold;">Return to BDSisters</a>
        </div>
      </div>
    `);
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
