import { Request, Response } from "express";
import mongoose from "mongoose";
import { Post, IPost } from "../models/Post.model";
import { ForumCategory } from "../models/ForumCategory.model";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import {
  createPostSchema,
  addCommentSchema,
  reportPostSchema,
  forumQuerySchema,
  createCategorySchema,
  updateCategorySchema,
  categoryToWingMap,
} from "../validations/forum.validation";

// ─── Helper: Format Post for Tiered Access (Guest vs Member) ───────────────────
const formatPostForViewer = (postDoc: IPost | any, viewer?: { id: string; role: string }): any => {
  const post = postDoc.toObject ? postDoc.toObject() : { ...postDoc };

  const isGuest = !viewer;
  const isAdmin = viewer?.role === "Admin" || viewer?.role === "SuperAdmin";

  if (!isAdmin) {
    // Strip internal report logs for non-admins
    delete post.reports;
  }

  if (post.isAnonymous) {
    post.authorId = {
      _id: post.authorId?._id || post.authorId,
      fullName: "Anonymous Sister",
      role: "Member",
      profilePicture: "",
    };
  }

  // Derive a friendly title if not explicitly set
  const title =
    post.title ||
    (post.content
      ? post.content.split("\n")[0].slice(0, 80).trim()
      : "Community Discussion");

  const views = post.views ?? post.viewCount ?? 0;
  const viewCount = post.viewCount ?? post.views ?? 0;

  if (isGuest) {
    const isLongContent = post.content && post.content.length > 200;
    return {
      ...post,
      title,
      category: post.wingName || "General",
      content: isLongContent ? `${post.content.slice(0, 200)}...` : post.content,
      isTeaser: true,
      ctaMessage: "Be a member to read the post. It's Free",
      comments: [], // Comments hidden for unauthenticated guests
      commentCount: postDoc.comments ? postDoc.comments.length : 0,
      likesCount: postDoc.likes ? postDoc.likes.length : 0,
      views,
      viewCount,
      reportsCount: postDoc.reportCount ?? (postDoc.reports ? postDoc.reports.length : 0),
      isReported: (postDoc.reportCount ?? 0) > 0,
    };
  }

  // Full view for authenticated members (Member, PaidMember, Admin, SuperAdmin)
  return {
    ...post,
    title,
    category: post.wingName || "General",
    isTeaser: false,
    commentCount: postDoc.comments ? postDoc.comments.length : 0,
    likesCount: postDoc.likes ? postDoc.likes.length : 0,
    views,
    viewCount,
    reportsCount: postDoc.reportCount ?? (postDoc.reports ? postDoc.reports.length : 0),
    isReported: (postDoc.reportCount ?? 0) > 0,
    isLiked: viewer ? postDoc.likes?.some((l: any) => l.toString() === viewer.id) : false,
  };
};

// ─── 1. Create New Post (POST /posts/create) ──────────────────────────────────
// Protected: PaidMember, Admin, SuperAdmin
export const createPost = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const validationResult = createPostSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { wingName, content, mediaUrls, title, isAnonymous, tags } = validationResult.data;

    const newPost = new Post({
      authorId: new mongoose.Types.ObjectId(req.user.id),
      wingName,
      title: title || (content ? content.split("\n")[0].slice(0, 100).trim() : "Community Discussion"),
      content,
      mediaUrls: mediaUrls || [],
      isAnonymous: Boolean(isAnonymous),
      tags: tags || [],
      views: 0,
      viewCount: 0,
    });

    await newPost.save();
    await newPost.populate("authorId", "fullName profilePicture role");

    res.status(201).json({
      success: true,
      message: "Post created successfully in the community forum!",
      data: newPost,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 2. Get All Posts (GET /posts) ───────────────────────────────────────────
// Tiered access: Guest gets teaser, Members get full content
export const getPosts = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const validationResult = forumQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { wing, category, page, limit, search, includeHidden, filter } = validationResult.data;

    const isAdmin =
      req.user?.role === "Admin" || req.user?.role === "SuperAdmin";

    const query: any = { isDeleted: false };

    // Unless admin explicitly requests includeHidden or filter === "hidden", exclude hidden
    if (!isAdmin || !includeHidden) {
      if (filter !== "hidden") {
        query.isHidden = { $ne: true };
      }
    }

    if (filter === "reported") {
      query.reportCount = { $gt: 0 };
    } else if (filter === "hidden") {
      query.isHidden = true;
    }

    const effectiveWing =
      (wing && wing !== "All" ? wing : undefined) ||
      (category && category !== "All"
        ? categoryToWingMap[category.toLowerCase().trim()] || category
        : undefined);

    if (effectiveWing && effectiveWing.trim() !== "") {
      query.wingName = effectiveWing;
    }

    if (search && search.trim() !== "") {
      query.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { content: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const total = await Post.countDocuments(query);

    const posts = await Post.find(query)
      .populate("authorId", "fullName profilePicture role email")
      .populate("comments.commenterId", "fullName profilePicture role email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const formattedPosts = posts.map((p) => formatPostForViewer(p, req.user));

    res.status(200).json({
      success: true,
      count: formattedPosts.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: formattedPosts,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 3. Get Single Post (GET /posts/:id) ──────────────────────────────────────
export const getPostById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid post ID." });
      return;
    }

    // Atomically increment views and viewCount on every visit
    const post = await Post.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $inc: { views: 1, viewCount: 1 } },
      { new: true }
    )
      .populate("authorId", "fullName profilePicture role")
      .populate("comments.commenterId", "fullName profilePicture role");

    if (!post) {
      res.status(404).json({ success: false, message: "Post not found." });
      return;
    }

    const formattedPost = formatPostForViewer(post, req.user);

    res.status(200).json({
      success: true,
      data: formattedPost,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 4. Add Comment to a Post (POST /posts/:id/comment) ──────────────────────
// Protected: PaidMember, Admin, SuperAdmin
export const addComment = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid post ID." });
      return;
    }

    const validationResult = addCommentSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { comment } = validationResult.data;

    const post = await Post.findOne({ _id: id, isDeleted: false });
    if (!post) {
      res.status(404).json({ success: false, message: "Post not found." });
      return;
    }

    post.comments.push({
      commenterId: new mongoose.Types.ObjectId(req.user.id),
      comment,
      createdAt: new Date(),
    } as any);

    await post.save();
    await post.populate("comments.commenterId", "fullName profilePicture role");

    res.status(200).json({
      success: true,
      message: "Comment added successfully!",
      data: post.comments[post.comments.length - 1],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 5. Toggle Like / Unlike (POST /posts/:id/like) ───────────────────────────
// Protected: any authenticated member (Member, PaidMember, Admin, SuperAdmin)
export const toggleLikePost = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid post ID." });
      return;
    }

    const post = await Post.findOne({ _id: id, isDeleted: false });
    if (!post) {
      res.status(404).json({ success: false, message: "Post not found." });
      return;
    }

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const likeIndex = post.likes.findIndex((l) => l.toString() === req.user?.id);

    let isLiked = false;
    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
      isLiked = false;
    } else {
      // Like
      post.likes.push(userId);
      isLiked = true;
    }

    await post.save();

    res.status(200).json({
      success: true,
      message: isLiked ? "Post liked!" : "Post unliked.",
      isLiked,
      likesCount: post.likes.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 6. Report Post (POST /posts/:id/report) ──────────────────────────────────
// Protected: any authenticated member
export const reportPost = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid post ID." });
      return;
    }

    const validationResult = reportPostSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { reason } = validationResult.data;

    const post = await Post.findOne({ _id: id, isDeleted: false });
    if (!post) {
      res.status(404).json({ success: false, message: "Post not found." });
      return;
    }

    post.reports.push({
      reporterId: new mongoose.Types.ObjectId(req.user.id),
      reason,
      createdAt: new Date(),
    });
    post.reportCount += 1;

    await post.save();

    res.status(200).json({
      success: true,
      message: "Post reported successfully. Our moderation team will review it.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 7. Delete Post (DELETE /posts/:id) ───────────────────────────────────────
// Protected: Post author OR Admin / SuperAdmin
export const deletePost = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid post ID." });
      return;
    }

    const post = await Post.findById(id);
    if (!post || post.isDeleted) {
      res.status(404).json({ success: false, message: "Post not found." });
      return;
    }

    const isAuthor = post.authorId.toString() === req.user.id;
    const isAdmin =
      req.user.role === "Admin" || req.user.role === "SuperAdmin";

    if (!isAuthor && !isAdmin) {
      res.status(403).json({
        success: false,
        message: "Access denied. You can only delete your own posts.",
      });
      return;
    }

    // Soft delete
    post.isDeleted = true;
    await post.save();

    res.status(200).json({
      success: true,
      message: "Post deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 7b. Moderate Post (PATCH /posts/:id/moderate or PATCH /posts/:id) ─────────
// Protected: Admin / SuperAdmin
export const moderatePost = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid post ID." });
      return;
    }

    const post = await Post.findOne({ _id: id, isDeleted: false });
    if (!post) {
      res.status(404).json({ success: false, message: "Post not found." });
      return;
    }

    const { isHidden, isLocked, clearReports, title, content } = req.body;

    if (isHidden !== undefined) post.isHidden = Boolean(isHidden);
    if (isLocked !== undefined) post.isLocked = Boolean(isLocked);
    if (title !== undefined) post.title = String(title).slice(0, 300);
    if (content !== undefined) post.content = String(content).slice(0, 2000);

    if (clearReports) {
      post.reportCount = 0;
      post.reports = [] as any;
    }

    await post.save();
    await post.populate("authorId", "fullName profilePicture role email");

    res.status(200).json({
      success: true,
      message: "Post moderated successfully.",
      data: formatPostForViewer(post, req.user),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── Default Forum Categories ───────────────────────────────────────────────
export const DEFAULT_FORUM_CATEGORIES = [
  {
    name: "Faith & Personal Growth",
    slug: "faith-and-growth",
    wingName: "FaithAndGrowth",
    description: "Spiritual reflections, Islamic habits, and sisterhood reminders.",
    order: 1,
  },
  {
    name: "Family & Parenting",
    slug: "family-and-parenting",
    wingName: "FamilyAndParenting",
    description: "Motherhood, tarbiyah, and homeschooling dialogues (CoP).",
    order: 2,
  },
  {
    name: "Sisters in Business",
    slug: "sisters-in-business",
    wingName: "SistersInBusiness",
    description: "Halal entrepreneurship, marketing, and e-commerce advice.",
    order: 3,
  },
  {
    name: "Health & Wellness",
    slug: "health-and-wellness",
    wingName: "HealthAndWellness",
    description: "Mental, physical, and holistic wellbeing for women.",
    order: 4,
  },
  {
    name: "Skills Exchange (Ask & Offer)",
    slug: "skills-exchange",
    wingName: "SkillsExchange",
    description: "Peer-to-peer skill sharing, collaborations, and project help.",
    order: 5,
  },
  {
    name: "Project Tasks",
    slug: "project-tasks",
    wingName: "ProjectTasks",
    description: "Collaborative sisterhood initiatives and task boards.",
    order: 6,
  },
  {
    name: "General Community",
    slug: "general-community",
    wingName: "General",
    description: "Open discussions, introductions, and general sisterhood banter.",
    order: 7,
  },
];

// ─── 8. Get Forum Categories (GET /categories) ───────────────────────────────
export const getForumCategories = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    let categories = await ForumCategory.find({ isActive: true }).sort({
      order: 1,
      createdAt: 1,
    });

    // Seed defaults if collection is empty
    if (categories.length === 0) {
      await ForumCategory.insertMany(DEFAULT_FORUM_CATEGORIES);
      categories = await ForumCategory.find({ isActive: true }).sort({
        order: 1,
        createdAt: 1,
      });
    }

    // Compute live post / topic counts
    const postCounts = await Post.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$wingName", count: { $sum: 1 } } },
    ]);
    const countMap: Record<string, number> = {};
    postCounts.forEach((pc) => {
      if (pc._id) countMap[pc._id] = pc.count;
    });

    const categoriesWithCount = categories.map((cat) => {
      const obj = cat.toObject ? cat.toObject() : { ...cat };
      const count = countMap[cat.wingName || ""] || 0;
      return {
        ...obj,
        id: obj.slug,
        postCount: count,
        topicCount: count,
      };
    });

    res.status(200).json({
      success: true,
      data: categoriesWithCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 8a. Create Forum Category (POST /categories) ─────────────────────────────
// Protected: Admin, SuperAdmin
export const createForumCategory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid forum category payload.",
        errors: parsed.error.issues,
      });
      return;
    }

    const { name, description, order, wingName, icon } = parsed.data;
    const slug = (
      parsed.data.slug ||
      name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    ).trim();

    const existing = await ForumCategory.findOne({
      $or: [{ name: name.trim() }, { slug }],
    });
    if (existing) {
      res.status(409).json({
        success: false,
        message: "A category with this name or slug already exists.",
      });
      return;
    }

    const newCategory = await ForumCategory.create({
      name: name.trim(),
      slug,
      description: description?.trim() || "",
      wingName: wingName?.trim() || "General",
      order: order ?? 0,
      icon,
      createdBy: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: "Forum category created successfully.",
      data: newCategory,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 8b. Update Forum Category (PATCH /categories/:id) ────────────────────────
// Protected: Admin, SuperAdmin
export const updateForumCategory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      res.status(400).json({ success: false, message: "Category ID required." });
      return;
    }

    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid forum category payload.",
        errors: parsed.error.issues,
      });
      return;
    }

    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { slug: id };

    const updatePayload: Record<string, any> = { ...parsed.data };
    if (parsed.data.name && !parsed.data.slug) {
      updatePayload.slug = parsed.data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }

    const updated = await ForumCategory.findOneAndUpdate(
      query,
      { $set: updatePayload },
      { new: true, runValidators: true }
    );

    if (!updated) {
      res.status(404).json({ success: false, message: "Forum category not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Forum category updated successfully.",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 8c. Delete Forum Category (DELETE /categories/:id) ───────────────────────
// Protected: Admin, SuperAdmin
export const deleteForumCategory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      res.status(400).json({ success: false, message: "Category ID required." });
      return;
    }

    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { slug: id };

    const deleted = await ForumCategory.findOneAndDelete(query);
    if (!deleted) {
      res.status(404).json({ success: false, message: "Forum category not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Forum category deleted successfully.",
      data: deleted,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 9. Get Post Comments (GET /posts/:id/comments) ──────────────────────────
export const getPostComments = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid post ID." });
      return;
    }

    const post = await Post.findOne({ _id: id, isDeleted: false })
      .populate("comments.commenterId", "fullName profilePicture role");

    if (!post) {
      res.status(404).json({ success: false, message: "Post not found." });
      return;
    }

    res.status(200).json({
      success: true,
      data: post.comments || [],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
