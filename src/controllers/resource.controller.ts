import { Request, Response } from "express";
import { ResourceLibrary } from "../models/ResourceLibrary.model";
import {
  createResourceSchema,
  updateResourceSchema,
} from "../validations/resource.validation";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// Helper for Express 5 params
const getParam = (param: unknown): string => {
  if (Array.isArray(param)) return String(param[0]);
  return typeof param === "string" ? param : "";
};

// ─── 1. Get Resources with Role-Based Access & Filtering ──────────────────────
export const getResources = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const userRole = req.user?.role || "Guest";
    const isAdmin = userRole === "Admin" || userRole === "SuperAdmin";

    const filter: Record<string, any> = {};

    // Only admins can see unpublished drafts
    if (!isAdmin) {
      filter.isPublished = true;
    }

    // Role-based visibility rules:
    if (userRole === "Guest") {
      filter.accessLevel = "Public";
    } else if (userRole === "Member") {
      filter.accessLevel = { $in: ["Public", "Member"] };
    } else if (userRole === "PaidMember") {
      filter.accessLevel = { $in: ["Public", "Member", "PaidMember"] };
    } // Admin has no accessLevel filter

    if (req.query.type) {
      if (req.query.type === "Publication") {
        filter.$or = [
          { type: { $in: ["Downloadable", "Article"] } },
          { wing: "TSPP" },
          { category: /publication/i },
        ];
      } else {
        filter.type = req.query.type;
      }
    }
    if (req.query.wing) filter.wing = req.query.wing;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.tag) filter.tags = req.query.tag;

    if (req.query.search) {
      const regex = new RegExp(req.query.search as string, "i");
      filter.$or = [{ title: regex }, { description: regex }, { tags: regex }];
    }

    const [resources, total] = await Promise.all([
      ResourceLibrary.find(filter)
        .populate("authorId", "fullName email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ResourceLibrary.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: resources,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 2. Get Single Resource by ID or Slug ─────────────────────────────────────
export const getResourceById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const resource = await ResourceLibrary.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { slug: id }],
    }).populate("authorId", "fullName email role");

    if (!resource) {
      res.status(404).json({ success: false, message: "Resource not found." });
      return;
    }

    const userRole = req.user?.role || "Guest";
    const isAdmin = userRole === "Admin" || userRole === "SuperAdmin";

    if (!resource.isPublished && !isAdmin) {
      res.status(404).json({ success: false, message: "Resource not found." });
      return;
    }

    // Role check
    if (resource.accessLevel === "Admin" && !isAdmin) {
      res.status(403).json({ success: false, message: "Admin access required." });
      return;
    }
    if (
      resource.accessLevel === "PaidMember" &&
      userRole !== "PaidMember" &&
      !isAdmin
    ) {
      res.status(403).json({
        success: false,
        message: "Paid Membership required to access this resource.",
      });
      return;
    }
    if (
      resource.accessLevel === "Member" &&
      userRole === "Guest"
    ) {
      res.status(403).json({
        success: false,
        message: "Sisterhood Membership required to access this resource. Registration is Free!",
      });
      return;
    }

    // Increment view count
    resource.viewCount += 1;
    await resource.save();

    res.status(200).json({ success: true, data: resource });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 3. Create Resource (Admin/Staff Only) ────────────────────────────────────
export const createResource = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const validationResult = createResourceSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const data = validationResult.data;
    let slug = data.slug;
    if (!slug) {
      slug = data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
    }

    let uniqueSlug = slug;
    let counter = 1;
    while (await ResourceLibrary.findOne({ slug: uniqueSlug })) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    const type = data.type || data.format || "Downloadable";
    const format = data.format || data.type || "Downloadable";

    const resource = await ResourceLibrary.create({
      ...data,
      slug: uniqueSlug,
      type,
      format,
      authorId: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: "Resource created successfully.",
      data: resource,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 4. Update Resource (Admin Only) ──────────────────────────────────────────
export const updateResource = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const validationResult = updateResourceSchema.safeParse(req.body);

    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const updateData: any = { ...validationResult.data };
    if (updateData.type && !updateData.format) updateData.format = updateData.type;
    if (updateData.format && !updateData.type) updateData.type = updateData.format;

    const resource = await ResourceLibrary.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    if (!resource) {
      res.status(404).json({ success: false, message: "Resource not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Resource updated successfully.",
      data: resource,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 5. Delete Resource (Admin Only) ──────────────────────────────────────────
export const deleteResource = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const resource = await ResourceLibrary.findByIdAndDelete(id);

    if (!resource) {
      res.status(404).json({ success: false, message: "Resource not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Resource deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 6. Track Resource Download / View Count ──────────────────────────────────
export const trackDownload = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);

    // Atomically increment downloadCount, downloadsCount, and downloadsOrReads
    const resource = await ResourceLibrary.findByIdAndUpdate(
      id,
      {
        $inc: {
          downloadCount: 1,
          downloadsCount: 1,
          downloadsOrReads: 1,
        },
      },
      { new: true }
    );

    if (!resource) {
      res.status(404).json({ success: false, message: "Resource not found." });
      return;
    }

    const currentCount = Number(
      resource.downloadsOrReads ?? resource.downloadsCount ?? resource.downloadCount ?? 1
    );

    res.status(200).json({
      success: true,
      message: "Resource access tracked successfully.",
      data: {
        _id: resource._id,
        fileUrl: resource.fileUrl || resource.videoUrl,
        downloadCount: currentCount,
        downloadsCount: currentCount,
        downloadsOrReads: currentCount,
      },
      downloadCount: currentCount,
      downloadsCount: currentCount,
      downloadsOrReads: currentCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
