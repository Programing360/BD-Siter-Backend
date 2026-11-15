import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import connectDB from "./config/db";
import authRoutes from "./routes/auth.routes";
import businessRoutes from "./routes/business.routes";
import ecommerceRoutes from "./routes/ecommerce.routes";
import forumRoutes from "./routes/forum.routes";
import eventRoutes from "./routes/event.routes";
import adminRoutes from "./routes/admin.routes";
import paymentRoutes from "./routes/payment.routes";

dotenv.config();
// Connect to MongoDB
connectDB();
const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/ecommerce", ecommerceRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payment", paymentRoutes);
// Test Route
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Welcome to BDSisters.org Backend API!",
  });
});

// Server Listen
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
