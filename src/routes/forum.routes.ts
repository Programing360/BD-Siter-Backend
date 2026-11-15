import { Router } from "express";
import {
  createPost,
  getPosts,
  addComment,
} from "../controllers/forum.controller";

const router = Router();

router.post("/posts/create", createPost);
router.get("/posts", getPosts);
router.post("/posts/:postId/comment", addComment);

const forumRoutes = router;

export default forumRoutes;
