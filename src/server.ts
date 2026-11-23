import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Ensure .env is loaded whether running from project root or backend directory
const candidateEnvPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "bdsisters-backend", ".env"),
  path.resolve(__dirname, "../.env"),
];
const envPath = candidateEnvPaths.find((p) => fs.existsSync(p));
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import connectDB from "./config/db";

// Routes
import authRoutes from "./routes/auth.routes";
import businessRoutes from "./routes/business.routes";
import ecommerceRoutes from "./routes/ecommerce.routes";
import forumRoutes from "./routes/forum.routes";
import eventRoutes from "./routes/event.routes";
import adminRoutes from "./routes/admin.routes";
import paymentRoutes from "./routes/payment.routes";
import userRoutes from "./routes/user.routes";
import cmsRoutes from "./routes/cms.routes";
import notificationRoutes from "./routes/notification.routes";
import communicationRoutes from "./routes/communication.routes";
import resourceRoutes from "./routes/resource.routes";
import goalRoutes from "./routes/goal.routes";
import integrationRoutes from "./routes/integration.routes";

// Middlewares & Docs
import { swaggerDocument } from "./docs/swagger";
import {
  paymentLimiter,
  generalLimiter,
  mongoSanitizer,
} from "./middlewares/rateLimiter";
import uploadRouter from "./routes/upload.route";

// Connect to MongoDB
connectDB();
const app: Application = express();
const PORT = process.env.PORT || 5000;

// CORS configuration (restricted to configured frontend URL and local dev)
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) or whitelisted origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS policy."));
      }
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(helmet());
app.use(morgan("dev"));
app.use(mongoSanitizer);

// Swagger / OpenAPI documentation
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// General rate limiter on API
app.use("/api", generalLimiter);

app.use("/api/upload", uploadRouter);
// Specific rate limiters for security-sensitive paths
app.use("/api/auth", authRoutes);
app.use("/api/payment/zinipay/init", paymentLimiter);
app.use("/api/payment/init", paymentLimiter);


// Mounted Routes
app.use("/api/business", businessRoutes);
app.use("/api/ecommerce", ecommerceRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cms", cmsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/v1/integration", integrationRoutes);
app.use("/api", communicationRoutes); // provides /api/contact, /api/newsletter/subscribe, etc.

// Health / Welcome Route
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Welcome to BDSisters.org Backend API!",
    documentation: "/api/docs",
  });
});

// Server Listen
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(
    `API Documentation available at http://localhost:${PORT}/api/docs`,
  );
});
