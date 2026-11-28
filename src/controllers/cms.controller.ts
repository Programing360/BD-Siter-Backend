import { Request, Response } from "express";
import { CmsPage, IContentBlock } from "../models/CmsPage.model";
import { CmsBlock } from "../models/CmsBlock.model";
import { logAdminAction } from "../models/AuditLog.model";
import {
  createCmsPageSchema,
  updateCmsPageSchema,
  createContentBlockSchema,
  updateContentBlockSchema,
  reorderBlocksSchema,
  createCmsBlockSchema,
  updateCmsBlockSchema,
} from "../validations/cms.validation";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { MasterLookup, LookupType } from "../models/MasterLookup.model";

// Helper for Express 5 params
const getParam = (param: unknown): string => {
  if (Array.isArray(param)) return String(param[0]);
  return typeof param === "string" ? param : "";
};

// ─── Public Endpoints ────────────────────────────────────────────────────────

// 1. Get Navigation Menu (published pages configured to show in nav)
export const getNavigationMenu = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const navItems = await CmsPage.find({
      isPublished: true,
      $or: [{ showInHeader: true }, { showInNav: true }],
    })
      .select("slug title navLabel navOrder showInHeader showInNav")
      .sort({ navOrder: 1, title: 1 });

    res.status(200).json({
      success: true,
      data: navItems,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 2. Get All Published Pages List
export const getPublishedPages = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const pages = await CmsPage.find({ isPublished: true })
      .select("slug title metaDescription showInNav showInHeader navLabel navOrder updatedAt")
      .sort({ navOrder: 1, title: 1 });

    res.status(200).json({
      success: true,
      count: pages.length,
      data: pages,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 3. Get Single Page by Slug (Public View)
// Returns page and its visible content blocks with hover tooltips
export const getPageBySlug = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const slug = getParam(req.params.slug).toLowerCase();
    const page = await CmsPage.findOne({ slug });

    if (!page) {
      res.status(404).json({ success: false, message: "Page not found." });
      return;
    }

    if (!page.isPublished) {
      res.status(404).json({ success: false, message: "Page is not published." });
      return;
    }

    // Filter to only visible blocks and sort by order
    const visibleBlocks = page.blocks
      .filter((b) => b.isVisible)
      .sort((a, b) => a.order - b.order);

    res.status(200).json({
      success: true,
      data: {
        id: page._id,
        slug: page.slug,
        title: page.title,
        metaDescription: page.metaDescription,
        showInNav: page.showInNav,
        navLabel: page.navLabel,
        blocks: visibleBlocks,
        updatedAt: page.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Admin Endpoints ─────────────────────────────────────────────────────────

// 4. Get All Pages (Admin View: includes drafts & unpublished)
export const getAllPagesForAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const pages = await CmsPage.find()
      .populate("lastEditedBy", "fullName email")
      .sort({ navOrder: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: pages.length,
      data: pages,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 5. Create Page
export const createPage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const validationResult = createCmsPageSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { slug, title, metaDescription, isPublished, showInNav, navLabel, navOrder } =
      validationResult.data;

    const existing = await CmsPage.findOne({ slug });
    if (existing) {
      res.status(400).json({
        success: false,
        message: `Page with slug "${slug}" already exists.`,
      });
      return;
    }

    const page = await CmsPage.create({
      slug,
      title,
      metaDescription,
      isPublished,
      showInNav,
      navLabel: navLabel || title,
      navOrder,
      blocks: [],
      lastEditedBy: req.user?.id,
    });

    if (req.user) {
      await logAdminAction({
        adminId: req.user.id,
        action: "CREATE_CMS_PAGE",
        targetModel: "CmsPage",
        targetId: page._id as any,
        details: { slug, title },
        ipAddress: req.ip,
      });
    }

    res.status(201).json({
      success: true,
      message: "Page created successfully.",
      data: page,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 6. Get Page by ID (Admin View)
export const getPageByIdForAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const page = await CmsPage.findById(id).populate(
      "lastEditedBy",
      "fullName email"
    );

    if (!page) {
      res.status(404).json({ success: false, message: "Page not found." });
      return;
    }

    // Sort blocks by order
    page.blocks.sort((a, b) => a.order - b.order);

    res.status(200).json({ success: true, data: page });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 7. Update Page Settings / Publishing
export const updatePage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const validationResult = updateCmsPageSchema.safeParse(req.body);

    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const page = await CmsPage.findById(id);
    if (!page) {
      res.status(404).json({ success: false, message: "Page not found." });
      return;
    }

    const data = validationResult.data;
    if (data.title) page.title = data.title;
    if (data.metaDescription !== undefined) page.metaDescription = data.metaDescription;
    if (data.isPublished !== undefined) page.isPublished = data.isPublished;
    if (data.showInHeader !== undefined) {
      page.showInHeader = data.showInHeader;
      page.showInNav = data.showInHeader;
    } else if (data.showInNav !== undefined) {
      page.showInNav = data.showInNav;
      page.showInHeader = data.showInNav;
    }
    if (data.navLabel !== undefined) page.navLabel = data.navLabel;
    if (data.navOrder !== undefined) page.navOrder = data.navOrder;
    page.lastEditedBy = req.user?.id as any;

    await page.save();

    if (req.user) {
      await logAdminAction({
        adminId: req.user.id,
        action: "UPDATE_CMS_PAGE",
        targetModel: "CmsPage",
        targetId: page._id as any,
        details: { slug: page.slug, isPublished: page.isPublished },
        ipAddress: req.ip,
      });
    }

    res.status(200).json({
      success: true,
      message: "Page updated successfully.",
      data: page,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 8. Delete Page
export const deletePage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const page = await CmsPage.findByIdAndDelete(id);

    if (!page) {
      res.status(404).json({ success: false, message: "Page not found." });
      return;
    }

    if (req.user) {
      await logAdminAction({
        adminId: req.user.id,
        action: "DELETE_CMS_PAGE",
        targetModel: "CmsPage",
        targetId: id,
        details: { slug: page.slug, title: page.title },
        ipAddress: req.ip,
      });
    }

    res.status(200).json({
      success: true,
      message: "Page deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Block Operations (Content, Images & Tooltips) ───────────────────────────

// 9. Add Block to Page
export const addContentBlock = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const validationResult = createContentBlockSchema.safeParse(req.body);

    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const page = await CmsPage.findById(id);
    if (!page) {
      res.status(404).json({ success: false, message: "Page not found." });
      return;
    }

    const blockData = validationResult.data;

    // Check for duplicate blockId
    const exists = page.blocks.some((b) => b.blockId === blockData.blockId);
    if (exists) {
      res.status(400).json({
        success: false,
        message: `Block ID "${blockData.blockId}" already exists on this page.`,
      });
      return;
    }

    page.blocks.push(blockData as IContentBlock);
    page.lastEditedBy = req.user?.id as any;
    await page.save();

    if (req.user) {
      await logAdminAction({
        adminId: req.user.id,
        action: "ADD_CMS_BLOCK",
        targetModel: "CmsPage",
        targetId: id,
        details: { blockId: blockData.blockId, title: blockData.title },
        ipAddress: req.ip,
      });
    }

    res.status(201).json({
      success: true,
      message: "Content block added successfully.",
      data: page.blocks,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 10. Update Block (Edit content, title, image, order, and HOVER TOOLTIP)
export const updateContentBlock = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const blockId = getParam(req.params.blockId);
    const validationResult = updateContentBlockSchema.safeParse(req.body);

    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const page = await CmsPage.findById(id);
    if (!page) {
      res.status(404).json({ success: false, message: "Page not found." });
      return;
    }

    const block = page.blocks.find(
      (b) => b.blockId === blockId || (b as any)._id?.toString() === blockId
    );
    if (!block) {
      res.status(404).json({ success: false, message: "Content block not found." });
      return;
    }

    const data = validationResult.data;
    if (data.title) block.title = data.title;
    if (data.subtitle !== undefined) block.subtitle = data.subtitle;
    if (data.content !== undefined) block.content = data.content;
    if (data.order !== undefined) block.order = data.order;
    if (data.isVisible !== undefined) block.isVisible = data.isVisible;
    if (data.imageUrl !== undefined) block.imageUrl = data.imageUrl;
    if (data.hoverTooltip !== undefined) block.hoverTooltip = data.hoverTooltip;
    if (data.ctaText !== undefined) block.ctaText = data.ctaText;
    if (data.ctaLink !== undefined) block.ctaLink = data.ctaLink;
    if (data.metadata !== undefined) block.metadata = data.metadata;

    page.lastEditedBy = req.user?.id as any;
    await page.save();

    if (req.user) {
      await logAdminAction({
        adminId: req.user.id,
        action: "UPDATE_CMS_BLOCK",
        targetModel: "CmsPage",
        targetId: id,
        details: { blockId, title: block.title, hoverTooltip: block.hoverTooltip },
        ipAddress: req.ip,
      });
    }

    res.status(200).json({
      success: true,
      message: "Content block updated successfully.",
      data: block,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 11. Delete Block
export const deleteContentBlock = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const blockId = getParam(req.params.blockId);

    const page = await CmsPage.findById(id);
    if (!page) {
      res.status(404).json({ success: false, message: "Page not found." });
      return;
    }

    const initialLength = page.blocks.length;
    page.blocks = page.blocks.filter(
      (b) => b.blockId !== blockId && (b as any)._id?.toString() !== blockId
    ) as any;

    if (page.blocks.length === initialLength) {
      res.status(404).json({ success: false, message: "Content block not found." });
      return;
    }

    page.lastEditedBy = req.user?.id as any;
    await page.save();

    if (req.user) {
      await logAdminAction({
        adminId: req.user.id,
        action: "DELETE_CMS_BLOCK",
        targetModel: "CmsPage",
        targetId: id,
        details: { blockId },
        ipAddress: req.ip,
      });
    }

    res.status(200).json({
      success: true,
      message: "Content block removed successfully.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// 12. Reorder Blocks on a Page
export const reorderContentBlocks = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const validationResult = reorderBlocksSchema.safeParse(req.body);

    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const page = await CmsPage.findById(id);
    if (!page) {
      res.status(404).json({ success: false, message: "Page not found." });
      return;
    }

    const orderMap = new Map<string, number>();
    validationResult.data.blockOrders.forEach(({ blockId, order }) => {
      orderMap.set(blockId, order);
    });

    page.blocks.forEach((block) => {
      if (orderMap.has(block.blockId)) {
        block.order = orderMap.get(block.blockId)!;
      }
    });

    page.blocks.sort((a, b) => a.order - b.order);
    page.lastEditedBy = req.user?.id as any;
    await page.save();

    if (req.user) {
      await logAdminAction({
        adminId: req.user.id,
        action: "REORDER_CMS_BLOCKS",
        targetModel: "CmsPage",
        targetId: id,
        details: { count: validationResult.data.blockOrders.length },
        ipAddress: req.ip,
      });
    }

    res.status(200).json({
      success: true,
      message: "Content blocks reordered successfully.",
      data: page.blocks,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};




// ─── Get All Visible Content Blocks (Public & Dynamic Platform) ──────────
export const getAllContentBlocks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { type, sectionKey, pageSlug, all } = req.query;

    // 1. Query dedicated CmsBlock collection
    const blockFilter: Record<string, any> = {};
    if (all !== "true" && !req.originalUrl.includes("/admin")) {
      blockFilter.isPublished = true;
    }
    if (sectionKey) blockFilter.sectionKey = String(sectionKey);
    if (type) blockFilter.blockType = String(type);

    const dedicatedBlocks = await CmsBlock.find(blockFilter).sort({ order: 1 });

    // 2. Query embedded page blocks for backward compatibility
    const pageFilter: Record<string, any> = {};
    if (all !== "true" && !req.originalUrl.includes("/admin")) {
      pageFilter.isPublished = true;
    }
    if (pageSlug) pageFilter.slug = String(pageSlug).toLowerCase();

    const pages = await CmsPage.find(pageFilter);
    const pageBlocks = pages.flatMap((p) =>
      p.blocks
        .filter((b) => b.isVisible)
        .map((b: any) => ({
          ...(b.toObject ? b.toObject() : b),
          sectionKey: b.blockId || "general",
          blockType: (b as any).blockType || "info",
          pageSlug: p.slug,
          pageTitle: p.title,
        }))
    );

    const filteredPageBlocks = type
      ? pageBlocks.filter(
        (b) => b.blockType?.toLowerCase() === String(type).toLowerCase()
      )
      : pageBlocks;

    // Combine dedicated blocks with page blocks
    const combined = [...dedicatedBlocks, ...filteredPageBlocks];

    res.status(200).json({
      success: true,
      count: combined.length,
      data: combined,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── CmsBlock CRUD Handlers for Admins ──────────────────────────────────────────

export const getCmsBlockById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const block = await CmsBlock.findById(req.params.id);
    if (!block) {
      res.status(404).json({ success: false, message: "CMS block not found." });
      return;
    }
    res.status(200).json({ success: true, data: block });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const createCmsBlock = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const parsed = createCmsBlockSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid CMS block payload.",
        errors: parsed.error.issues,
      });
      return;
    }

    const newBlock = await CmsBlock.create({
      ...parsed.data,
      lastEditedBy: req.user?.id,
    });

    if (req.user) {
      await logAdminAction({
        adminId: req.user.id,
        action: "CREATE_CMS_BLOCK",
        targetModel: "CmsBlock",
        targetId: String(newBlock._id),
        details: { sectionKey: newBlock.sectionKey, blockType: newBlock.blockType, title: newBlock.title },
      });
    }

    res.status(201).json({
      success: true,
      message: "CMS block created successfully.",
      data: newBlock,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const updateCmsBlock = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const parsed = updateCmsBlockSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid CMS block payload.",
        errors: parsed.error.issues,
      });
      return;
    }

    const updated = await CmsBlock.findByIdAndUpdate(
      req.params.id,
      {
        ...parsed.data,
        lastEditedBy: req.user?.id,
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      res.status(404).json({ success: false, message: "CMS block not found." });
      return;
    }

    if (req.user) {
      await logAdminAction({
        adminId: req.user.id,
        action: "UPDATE_CMS_BLOCK",
        targetModel: "CmsBlock",
        targetId: String(updated._id),
        details: { sectionKey: updated.sectionKey, title: updated.title },
      });
    }

    res.status(200).json({
      success: true,
      message: "CMS block updated successfully.",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const deleteCmsBlock = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const deleted = await CmsBlock.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, message: "CMS block not found." });
      return;
    }

    if (req.user) {
      await logAdminAction({
        adminId: req.user.id,
        action: "DELETE_CMS_BLOCK",
        targetModel: "CmsBlock",
        targetId: String(deleted._id),
        details: { sectionKey: deleted.sectionKey, title: deleted.title },
      });
    }

    res.status(200).json({
      success: true,
      message: "CMS block deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};


export const getMasterLookups = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.query;
    const filter: Record<string, unknown> = { isActive: true };
    if (type) filter.type = String(type);

    const items = await MasterLookup.find(filter).sort({ genreOrCategory: 1, name: 1 });
    const grouped: Record<LookupType, typeof items> = {
      subjects: [],
      software: [],
      vocationalSkills: [],
      socialIcons: [],
      businessRoles: [],
    };
    items.forEach((item) => {
      if (grouped[item.type]) grouped[item.type].push(item);
    });

    res.status(200).json({ success: true, data: type ? items : grouped });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const createMasterLookup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, genreOrCategory, name } = req.body;
    if (!type || !name) {
      res.status(400).json({ success: false, message: "Type and name are required." });
      return;
    }
    const created = await MasterLookup.create({
      type,
      genreOrCategory: genreOrCategory?.trim() || "General",
      name: name.trim(),
    });
    res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(409).json({ success: false, message: "Duplicate entry in this database." });
      return;
    }
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const deleteMasterLookup = async (req: Request, res: Response): Promise<void> => {
  try {
    await MasterLookup.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Lookup entry deleted." });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};