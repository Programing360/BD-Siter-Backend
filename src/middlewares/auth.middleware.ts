import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/User.model";

// ─── Augment Express Request ──────────────────────────────────────────────────

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: "Guest" | "Member" | "PaidMember" | "Admin" | "SuperAdmin";
    status: string;
  };
}

// ─── JWT Payload shape ────────────────────────────────────────────────────────

interface JwtPayload {
  id: string;
  role: string;
  status: string;
  iat?: number;
  exp?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeRole = (role?: string): string =>
  (role || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

const parseCookies = (cookieHeader?: string): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx > 0) {
      const key = pair.substring(0, idx).trim();
      const val = pair.substring(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  }
  return cookies;
};

interface ExtractedTokenInfo {
  token: string | null;
  isSessionToken: boolean;
}

const extractToken = (req: Request): ExtractedTokenInfo => {
  // 1. Check Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return { token: authHeader.slice(7).trim(), isSessionToken: false };
  }

  // 2. Check Cookie header
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.token) {
    return { token: cookies.token, isSessionToken: false };
  }
  if (cookies.auth_token) {
    return { token: cookies.auth_token, isSessionToken: false };
  }
  if (cookies.access_token) {
    return { token: cookies.access_token, isSessionToken: false };
  }
  if (cookies["better-auth.session_token"]) {
    return {
      token: cookies["better-auth.session_token"],
      isSessionToken: true,
    };
  }
  if (cookies.session_token) {
    return { token: cookies.session_token, isSessionToken: true };
  }

  return { token: null, isSessionToken: false };
};

/**
 * Resolve authenticated user from session collection if available (fallback)
 */
async function resolveUserFromSessionToken(token: string) {
  try {
    if (!mongoose.connection?.db) return null;
    const sessionDoc = await mongoose.connection.db
      .collection("session")
      .findOne({ token });

    if (
      sessionDoc &&
      (!sessionDoc.expiresAt || new Date(sessionDoc.expiresAt) > new Date())
    ) {
      const userId = sessionDoc.userId;
      if (!userId) return null;
      return await User.findById(userId).select("role status");
    }
  } catch {
    // Session lookup fallback
  }
  return null;
}

// ─── verifyToken — required auth ─────────────────────────────────────────────
export const verifyToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { token, isSessionToken } = extractToken(req);

    if (!token) {
      res.status(401).json({
        success: false,
        code: "NO_TOKEN",
        message: "Access denied. No authentication token provided.",
      });
      return;
    }

    // 1. If explicit session token from cookie, resolve against session store first
    if (isSessionToken) {
      const userFromSession = await resolveUserFromSessionToken(token);
      if (userFromSession) {
        if (userFromSession.status === "Suspended") {
          res.status(403).json({
            success: false,
            code: "ACCOUNT_SUSPENDED",
            message: "Your account has been suspended. Please contact admin.",
          });
          return;
        }

        req.user = {
          id: userFromSession._id.toString(),
          role: userFromSession.role,
          status: userFromSession.status,
        };
        next();
        return;
      }
    }

    // 2. Otherwise verify as JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      res
        .status(500)
        .json({ success: false, message: "Server configuration error." });
      return;
    }

    let decoded: JwtPayload | null = null;
    try {
      decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    } catch {
      // 3. Fallback: check if token is a valid session token
      const userFromSession = await resolveUserFromSessionToken(token);
      if (userFromSession) {
        if (userFromSession.status === "Suspended") {
          res.status(403).json({
            success: false,
            code: "ACCOUNT_SUSPENDED",
            message: "Your account has been suspended. Please contact admin.",
          });
          return;
        }

        req.user = {
          id: userFromSession._id.toString(),
          role: userFromSession.role,
          status: userFromSession.status,
        };
        next();
        return;
      }

      res.status(401).json({
        success: false,
        code: "INVALID_TOKEN",
        message: "Invalid or expired token. Please log in again.",
      });
      return;
    }

    // Verify user still exists and is active in DB
    const user = await User.findById(decoded.id).select("role status");
    if (!user) {
      res.status(401).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "The user belonging to this token no longer exists.",
      });
      return;
    }

    if (user.status === "Suspended") {
      res.status(403).json({
        success: false,
        code: "ACCOUNT_SUSPENDED",
        message: "Your account has been suspended. Please contact admin.",
      });
      return;
    }

    req.user = {
      id: decoded.id,
      role: user.role,
      status: user.status,
    };

    next();
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── optionalAuth — guest-friendly auth ──────────────────────────────────────
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { token, isSessionToken } = extractToken(req);

    if (!token) {
      next();
      return;
    }

    if (isSessionToken) {
      const userFromSession = await resolveUserFromSessionToken(token);
      if (userFromSession && userFromSession.status === "Active") {
        req.user = {
          id: userFromSession._id.toString(),
          role: userFromSession.role,
          status: userFromSession.status,
        };
      }
      next();
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      next();
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
      const user = await User.findById(decoded.id).select("role status");
      if (user && user.status === "Active") {
        req.user = {
          id: decoded.id,
          role: user.role,
          status: user.status,
        };
      }
    } catch {
      const userFromSession = await resolveUserFromSessionToken(token);
      if (userFromSession && userFromSession.status === "Active") {
        req.user = {
          id: userFromSession._id.toString(),
          role: userFromSession.role,
          status: userFromSession.status,
        };
      }
    }

    next();
  } catch {
    next();
  }
};

// ─── authorizeRoles — RBAC guard (Case & Underscore Insensitive) ──────────────
/**
 * Role-based access control. Must be used AFTER verifyToken.
 * Supports both 'SuperAdmin' and 'SUPER_ADMIN' seamlessly.
 */
export const authorizeRoles = (...allowedRoles: string[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      });
      return;
    }

    const userRoleNormalized = normalizeRole(req.user.role);
    const allowedNormalized = allowedRoles.map(normalizeRole);

    if (!allowedNormalized.includes(userRoleNormalized)) {
      res.status(403).json({
        success: false,
        code: "FORBIDDEN_ROLE",
        message: `Access denied. Required role(s): ${allowedRoles.join(", ")}. Your role: ${req.user.role}.`,
      });
      return;
    }

    next();
  };
};

// Alias for standard authentication guard
export const protect = verifyToken;
