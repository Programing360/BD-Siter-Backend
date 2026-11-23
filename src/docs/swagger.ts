export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "BDSisters.org API Documentation",
    version: "1.0.0",
    description:
      "Official REST API documentation for the BDSisters.org platform — empowering sisterhood, ethical commerce, personal development, and community collaboration.",
    contact: {
      name: "BDSisters.org Team",
      email: "support@bdsisters.org",
      url: "https://bdsisters.org",
    },
  },
  servers: [
    {
      url: "http://localhost:5000",
      description: "Development Server",
    },
    {
      url: "{BACKEND_URL}",
      description: "Production Server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter your Bearer token obtained from login or registration.",
      },
      apiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
        description: "Partner API key for cross-platform wing synchronization.",
      },
    },
  },
  tags: [
    { name: "Auth & Profile", description: "Authentication, referral, and member profiles" },
    { name: "Business", description: "Sister-owned business profiles & brands" },
    { name: "E-Commerce", description: "Product catalog, cart, orders, and reviews" },
    { name: "Forum", description: "Community discussion wings and posts" },
    { name: "Events", description: "Sisterhood community events and RSVPs" },
    { name: "Resource Library", description: "Articles, videos, and downloadable resources" },
    { name: "Goal Tracker", description: "Personal development goals and milestone tracking" },
    { name: "Notifications", description: "In-app notifications and alerts" },
    { name: "Communication", description: "Public contact form and newsletter subscription" },
    { name: "Payment & Checkout", description: "ZiniPay payment gateway, verification, and webhook IPN" },
    { name: "CMS", description: "Frontend-driven dynamic content pages and tooltips" },
    { name: "Cross-Platform Integration", description: "Wing sync APIs for partner organizations" },
    { name: "Admin Operations", description: "Platform analytics, user moderation, and audit logs" },
  ],
  paths: {
    "/api/auth/register": {
      post: {
        tags: ["Auth & Profile"],
        summary: "Register new sister member (referral code required)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fullName", "email", "password", "referralCode"],
                properties: {
                  fullName: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 6 },
                  referralCode: { type: "string" },
                  wings: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Registration successful — awaiting admin review or email verification" },
          400: { description: "Invalid referral code or duplicate email" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth & Profile"],
        summary: "Log in with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Login successful — returns JWT Bearer token and user info" },
          403: { description: "Account pending admin review or suspended" },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth & Profile"],
        summary: "Get current authenticated member profile",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Member profile retrieved" } },
      },
      patch: {
        tags: ["Auth & Profile"],
        summary: "Update current authenticated member profile",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Profile updated" } },
      },
    },
    "/api/auth/me/export-pdf": {
      get: {
        tags: ["Auth & Profile"],
        summary: "Download a clean PDF copy of member's verified profile",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "PDF stream",
            content: { "application/pdf": { schema: { type: "string", format: "binary" } } },
          },
        },
      },
    },
    "/api/business/my": {
      get: {
        tags: ["Business"],
        summary: "Get current user's business profile and registered brands",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Business details retrieved" } },
      },
    },
    "/api/ecommerce/products": {
      get: {
        tags: ["E-Commerce"],
        summary: "Get paginated products catalog with search, category, and brand filters",
        parameters: [
          { in: "query", name: "search", schema: { type: "string" } },
          { in: "query", name: "category", schema: { type: "string", enum: ["Product", "Service"] } },
          { in: "query", name: "isWholesale", schema: { type: "boolean" } },
          { in: "query", name: "page", schema: { type: "integer", default: 1 } },
          { in: "query", name: "limit", schema: { type: "integer", default: 20 } },
        ],
        responses: { 200: { description: "Products list" } },
      },
    },
    "/api/forum/posts": {
      get: {
        tags: ["Forum"],
        summary: "Get forum posts (tiered access: Guests receive 150-char teaser; Members get full post)",
        parameters: [
          { in: "query", name: "wingName", schema: { type: "string" } },
          { in: "query", name: "search", schema: { type: "string" } },
        ],
        responses: { 200: { description: "Forum posts list" } },
      },
    },
    "/api/events": {
      get: {
        tags: ["Events"],
        summary: "Get events (filtered by upcoming or past archives)",
        parameters: [
          { in: "query", name: "filter", schema: { type: "string", enum: ["upcoming", "past"] } },
        ],
        responses: { 200: { description: "Events list" } },
      },
    },
    "/api/resources": {
      get: {
        tags: ["Resource Library"],
        summary: "Browse articles, videos, and downloadables with role-based visibility",
        responses: { 200: { description: "Resource library items" } },
      },
    },
    "/api/goals": {
      get: {
        tags: ["Goal Tracker"],
        summary: "Get user's personal development goals and milestone progress",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Goals list" } },
      },
    },
    "/api/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "Get current user notifications",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "User notifications" } },
      },
    },
    "/api/contact": {
      post: {
        tags: ["Communication"],
        summary: "Submit public contact form inquiry",
        responses: { 201: { description: "Message sent and logged" } },
      },
    },
    "/api/newsletter/subscribe": {
      post: {
        tags: ["Communication"],
        summary: "Subscribe email to BDSisters newsletter",
        responses: { 201: { description: "Subscribed and welcome email sent" } },
      },
    },
    "/api/payment/zinipay/init": {
      post: {
        tags: ["Payment & Checkout"],
        summary: "Initiate ZiniPay payment for Business Subscriptions, E-Commerce Orders, or Paid Event Tickets",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["paymentType", "totalAmount"],
                properties: {
                  paymentType: {
                    type: "string",
                    enum: ["BusinessSubscription", "Order", "EventTicket"],
                  },
                  businessId: { type: "string" },
                  orderId: { type: "string" },
                  eventId: { type: "string" },
                  totalAmount: { type: "number" },
                  customerName: { type: "string" },
                  customerEmail: { type: "string" },
                  customerPhone: { type: "string" },
                  currency: { type: "string", default: "BDT" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Returns ZiniPay payment URL, invoice ID, and transaction ID" } },
      },
    },
    "/api/payment/zinipay/verify": {
      post: {
        tags: ["Payment & Checkout"],
        summary: "Verify ZiniPay transaction status and fulfill subscription/order/ticket",
        parameters: [
          { in: "query", name: "tranId", schema: { type: "string" } },
          { in: "query", name: "invoice_id", schema: { type: "string" } },
        ],
        responses: { 200: { description: "Payment verified and order fulfilled" } },
      },
      get: {
        tags: ["Payment & Checkout"],
        summary: "Browser return redirect handler after ZiniPay checkout",
        parameters: [
          { in: "query", name: "tranId", schema: { type: "string" } },
          { in: "query", name: "status", schema: { type: "string" } },
        ],
        responses: { 200: { description: "HTML confirmation / redirect" } },
      },
    },
    "/api/payment/zinipay/webhook": {
      post: {
        tags: ["Payment & Checkout"],
        summary: "ZiniPay Webhook / IPN listener for automated asynchronous fulfillment",
        responses: { 200: { description: "Webhook processed" } },
      },
    },
    "/api/cms/pages": {
      get: {
        tags: ["CMS"],
        summary: "List all published frontend pages and navigation items",
        responses: { 200: { description: "CMS pages" } },
      },
    },
    "/api/cms/pages/{slug}": {
      get: {
        tags: ["CMS"],
        summary: "Get dynamic page content blocks with hover tooltip explanations",
        parameters: [{ in: "path", name: "slug", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Page content blocks" } },
      },
    },
    "/api/v1/integration/members/{id}": {
      get: {
        tags: ["Cross-Platform Integration"],
        summary: "Get verified member details for external wing sync (e.g. Muhsina Org, CoP, TSPP)",
        security: [{ apiKeyAuth: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Synced verified member payload" } },
      },
    },
    "/api/admin/analytics": {
      get: {
        tags: ["Admin Operations"],
        summary: "Platform analytics dashboard (members, businesses, orders, revenue, commissions)",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Analytics statistics" } },
      },
    },
    "/api/admin/audit-logs": {
      get: {
        tags: ["Admin Operations"],
        summary: "Get paginated audit logs for all administrative actions",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Audit trail list" } },
      },
    },
  },
};
