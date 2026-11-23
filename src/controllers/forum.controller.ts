import { Response } from "express";
import mongoose from "mongoose";
import { Post, IPost } from "../models/Post.model";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import {
  createPostSchema,
  addCommentSchema,
  reportPostSchema,
  forumQuerySchema,
} from "../validations/forum.validation";

// ─── Helper: Format Post for Tiered Access (Guest vs Member) ───────────────────
const formatPostForViewer = (postDoc: IPost | any, viewer?: { id: string; role: string }): any => {
  const post = postDoc.toObject ? postDoc.toObject() : { ...postDoc };

  // Strip internal report logs
  delete post.reports;

  const isGuest = !viewer;

  if (isGuest) {
    const isLongContent = post.content && post.content.length > 150;
    return {
      ...post,
      content: isLongContent ? `${post.content.slice(0, 150)}...` : post.content,
      isTeaser: true,
      ctaMessage: "Be a member to read the full post. It's Free",
      comments: [], // Comments hidden for unauthenticated guests
      commentCount: postDoc.comments ? postDoc.comments.length : 0,
      likesCount: postDoc.likes ? postDoc.likes.length : 0,
    };
  }

  // Full view for authenticated members (Member, PaidMember, Admin, SuperAdmin)
  return {
    ...post,
    isTeaser: false,
    commentCount: postDoc.comments ? postDoc.comments.length : 0,
    likesCount: postDoc.likes ? postDoc.likes.length : 0,
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

    const { wingName, content, mediaUrls } = validationResult.data;

    const newPost = new Post({
      authorId: new mongoose.Types.ObjectId(req.user.id),
      wingName,
      content,
      mediaUrls: mediaUrls || [],
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

    const { wing, page, limit, search } = validationResult.data;

    const query: any = { isDeleted: false };

    if (wing && wing.trim() !== "") {
      query.wingName = wing;
    }

    if (search && search.trim() !== "") {
      query.content = { $regex: search.trim(), $options: "i" };
    }

    const skip = (page - 1) * limit;
    const total = await Post.countDocuments(query);

    const posts = await Post.find(query)
      .populate("authorId", "fullName profilePicture role")
      .populate("comments.commenterId", "fullName profilePicture role")
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

    const post = await Post.findOne({ _id: id, isDeleted: false })
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
