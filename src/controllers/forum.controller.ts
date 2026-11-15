import { Request, Response } from "express";
import { Post } from "../models/Post.model";
import {
  createPostSchema,
  addCommentSchema,
} from "../validations/forum.validation";

// Create New Post
export const createPost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const validationResult = createPostSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const newPost = new Post(validationResult.data);
    await newPost.save();

    res.status(201).json({
      success: true,
      message: "Post created successfully in the community forum!",
      data: newPost,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// Get All Posts (with optional wing filter)
export const getPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const wing = typeof req.query.wing === "string" ? req.query.wing : undefined;
    const filter = wing ? { wingName: wing } : {};

    const posts = await Post.find(filter)
      .populate("authorId", "fullName profilePicture role")
      .populate("comments.commenterId", "fullName profilePicture")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: posts.length,
      data: posts,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// Add Comment to a Post
export const addComment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { postId } = req.params;
    const validationResult = addCommentSchema.safeParse(req.body);

    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { commenterId, comment } = validationResult.data;

    const post = await Post.findById(postId);
    if (!post) {
      res.status(404).json({ success: false, message: "Post not found." });
      return;
    }

    post.comments.push({
      commenterId: commenterId as any,
      comment,
      createdAt: new Date(),
    });
    await post.save();

    res.status(200).json({
      success: true,
      message: "Comment added successfully!",
      data: post,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
