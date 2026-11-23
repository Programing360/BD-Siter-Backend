import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

// Auth rate limiter (prevents brute-force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication requests from this IP. Please try again after 15 minutes.",
  },
});

// Payment rate limiter
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many payment checkout requests. Please try again after 15 minutes.",
  },
});

// General API limiter
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down.",
  },
});

// Clean and sanitize objects against NoSQL injection
const sanitizeObject = (obj: any): any => {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const key of Object.keys(obj)) {
      if (key.startsWith("$") || key.includes(".")) {
        delete obj[key];
      } else {
        sanitizeObject(obj[key]);
      }
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item) => sanitizeObject(item));
  }
  return obj;
};

// NoSQL Injection sanitizer middleware
export const mongoSanitizer = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  next();
};
