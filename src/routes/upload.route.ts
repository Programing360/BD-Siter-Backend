import { Router, Request, Response } from "express";
import cloudinary from "../config/cloudinary";

const router = Router();

// GET বা POST /api/v1/upload/signature
router.get("/signature", (req: Request, res: Response) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const uploadPreset =
      process.env.CLOUDINARY_UPLOAD_PRESET || "bdsisters_nid";

    // ডিবাগ লগ (কাজ শেষে মুছে দেবেন)
    console.log("Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME);
    console.log("API Key:", process.env.CLOUDINARY_API_KEY);
    console.log(
      "Secret Exists:",
      !!process.env.CLOUDINARY_API_SECRET,
      "Length:",
      process.env.CLOUDINARY_API_SECRET?.length,
    );

    // Cloudinary-র নিয়ম অনুযায়ী যে প্যারামিটারগুলো আপলোডে যাবে, সেগুলো দিয়ে সিগনেচার তৈরি করতে হবে
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
});

const uploadRouter = router;

export default uploadRouter;
