import { Request, Response } from "express";
import axios from "axios";
import { Business } from "../models/Business.model";
import { User } from "../models/User.model";
import { sendEmail } from "../utils/sendEmail";

// 1. Initiate SSLCommerz Payment
export const initPayment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      businessId,
      userId,
      totalAmount,
      customerName,
      customerEmail,
      customerPhone,
    } = req.body;

    const transId = `TRAN_${Date.now()}`;
    const isLive = process.env.SSLCOMMERZ_IS_LIVE === "true";
    const gatewayUrl = isLive
      ? "https://securepay.sslcommerz.com/gwprocess/v4/api.v1.php"
      : "https://sandbox.sslcommerz.com/gwprocess/v4/api.v1.php";

    const postData = {
      store_id: process.env.SSLCOMMERZ_STORE_ID,
      store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD,
      total_amount: totalAmount,
      currency: "BDT",
      tran_id: transId,
      success_url: `http://localhost:5000/api/payment/success?businessId=${businessId}&userId=${userId}&tranId=${transId}`,
      fail_url: `http://localhost:5000/api/payment/fail`,
      cancel_url: `http://localhost:5000/api/payment/cancel`,
      ipn_url: `http://localhost:5000/api/payment/ipn`,
      cus_name: customerName,
      cus_email: customerEmail,
      cus_add1: "Bangladesh",
      cus_phone: customerPhone,
      shipping_method: "No",
      product_name: "Business Subscription",
      product_category: "Subscription",
      product_profile: "general",
    };

    const response = await axios.post(gatewayUrl, null, { params: postData });

    if (response.data && response.data.status === "SUCCESS") {
      res.status(200).json({
        success: true,
        gatewayPageURL: response.data.GatewayPageURL,
        transId,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to connect with SSLCommerz Gateway",
        error: response.data,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 2. Payment Success Handler (Updates Business Status & Sends Email)
export const paymentSuccess = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { businessId, userId } = req.query;

    if (!businessId || !userId) {
      res.status(400).json({
        success: false,
        message: "Invalid payment response parameters.",
      });
      return;
    }

    // Update Business Subscription to Paid and Publish Brands
    const business = await Business.findById(businessId);
    if (business) {
      business.subscriptionStatus = "Paid";
      business.brands.forEach((brand) => {
        brand.isPublished = true;
      });
      await business.save();
    }

    // Fetch User to get Email
    const user = await User.findById(userId);
    if (user && user.email) {
      // Send Confirmation Email
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #0f766e;">Assalamu Alaikum, ${user.fullName}!</h2>
          <p>Your payment for <strong>BDSisters.org Business Subscription</strong> has been successfully processed.</p>
          <p>All your registered brands have been published successfully.</p>
          <br/>
          <p>Jazakallahu Khairan for staying with us!</p>
          <p><strong>Team BDSisters.org</strong></p>
        </div>
      `;

      await sendEmail({
        email: user.email,
        subject: "Payment Successful - BDSisters.org",
        message:
          "Your payment was successful and your business subscription is now active.",
        html: emailHtml,
      });
    }

    // Redirect user to frontend success page (or return success JSON for testing)
    res.status(200).send(`
      <div style="text-align: center; margin-top: 50px; font-family: Arial;">
        <h1 style="color: green;">Payment Successful! 🎉</h1>
        <p>Your subscription is now active and confirmation email has been sent.</p>
        <a href="http://localhost:3000/dashboard" style="color: #0f766e; text-decoration: none; font-weight: bold;">Go to Dashboard</a>
      </div>
    `);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 3. Payment Fail Handler
export const paymentFail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  res.status(400).send(`
    <div style="text-align: center; margin-top: 50px; font-family: Arial;">
      <h1 style="color: red;">Payment Failed! ❌</h1>
      <p>Something went wrong during the transaction. Please try again.</p>
    </div>
  `);
};

// 4. Payment Cancel Handler
export const paymentCancel = async (
  req: Request,
  res: Response,
): Promise<void> => {
  res.status(400).send(`
    <div style="text-align: center; margin-top: 50px; font-family: Arial;">
      <h1 style="color: orange;">Payment Cancelled! ⚠️</h1>
      <p>You have cancelled the payment process.</p>
    </div>
  `);
};
