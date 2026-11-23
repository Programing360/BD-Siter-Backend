import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { ApiKey, IApiKey } from "../models/ApiKey.model";

export interface ApiKeyRequest extends Request {
  apiKey?: IApiKey;
}

export const verifyApiKey = async (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawKey =
      (req.headers["x-api-key"] as string) ||
      (req.headers.authorization?.startsWith("ApiKey ")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!rawKey) {
      res.status(401).json({
        success: false,
        message: "API key is required in x-api-key header or Authorization: ApiKey <key>",
      });
      return;
    }

    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const keyDoc = await ApiKey.findOne({ keyHash, isActive: true });

    if (!keyDoc) {
      res.status(401).json({
        success: false,
        message: "Invalid or inactive API key.",
      });
      return;
    }

    // Update lastUsedAt asynchronously
    keyDoc.lastUsedAt = new Date();
    await keyDoc.save();

    req.apiKey = keyDoc;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
