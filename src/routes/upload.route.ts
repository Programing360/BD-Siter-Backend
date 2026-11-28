import { Router, Request, Response } from "express";
import multer from "multer";
import cloudinary from "../config/cloudinary";
import { optionalAuth } from "../middlewares/auth.middleware";

const router = Router();

// Configure Multer for memory storage with 25MB max size
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max file size
  },
});

// Middleware that handles multipart/form-data safely without interfering with JSON requests
const uploadMiddleware = (req: Request, res: Response, next: any) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    upload.fields([
      { name: "file", maxCount: 1 },
      { name: "image", maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || "File upload validation failed (max file size: 25MB).",
        });
      }
      next();
    });
  } else {
    next();
  }
};

// GET or POST /api/upload/signature
const handleSignature = (req: Request, res: Response) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const uploadPreset =
      process.env.CLOUDINARY_UPLOAD_PRESET || "bdsisters_nid";

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        upload_preset: uploadPreset,
      },
      process.env.CLOUDINARY_API_SECRET as string,
    );

    res.status(200).json({
      success: true,
      data: {
        signature,
        timestamp,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        uploadPreset,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate Cloudinary signature",
    });
  }
};

router.get("/signature", handleSignature);
router.post("/signature", handleSignature);

// Helper function to stream memory buffer to Cloudinary
const uploadStreamToCloudinary = (buffer: Buffer, options: Record<string, any>): Promise<any> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
};

// POST /api/upload (Direct upload endpoint supporting both multipart/form-data & JSON Base64)
router.post("/", optionalAuth, uploadMiddleware, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const folder = body.folder || (req.query?.folder as string) || "bdsisters/resources";

    // 1. Check for multipart file from multer
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const fileItem = req.file || files?.file?.[0] || files?.image?.[0];

    // 2. Check for base64 / dataUrl / URL in request body
    const base64OrUrl = body.file || body.image || body.dataUrl || null;

    if (!fileItem && !base64OrUrl) {
      res.status(400).json({
        success: false,
        message: "No file, image, or data provided for upload.",
      });
      return;
    }

    if (!process.env.CLOUDINARY_API_SECRET) {
      res.status(500).json({
        success: false,
        message: "Cloudinary is not configured on the server.",
      });
      return;
    }

    let uploadResult: any;

    if (fileItem && fileItem.buffer) {
      // Upload binary buffer via Cloudinary stream
      uploadResult = await uploadStreamToCloudinary(fileItem.buffer, {
        folder,
        resource_type: "auto",
      });
    } else if (base64OrUrl) {
      // Upload string/dataURI
      uploadResult = await cloudinary.uploader.upload(base64OrUrl, {
        folder,
        resource_type: "auto",
      });
    }

    const uploadedUrl = uploadResult?.secure_url || uploadResult?.url;

    res.status(200).json({
      success: true,
      url: uploadedUrl,
      fileUrl: uploadedUrl,
      data: {
        url: uploadedUrl,
        fileUrl: uploadedUrl,
        secure_url: uploadResult?.secure_url,
        publicId: uploadResult?.public_id,
        format: uploadResult?.format,
        bytes: uploadResult?.bytes,
        resource_type: uploadResult?.resource_type,
        width: uploadResult?.width,
        height: uploadResult?.height,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message || "Failed to upload file to Cloudinary",
    });
  }
});

const uploadRouter = router;

export default uploadRouter;
