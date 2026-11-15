import { Schema, model, Document } from "mongoose";

export interface IPost extends Document {
  authorId: Schema.Types.ObjectId; // Linked to User model
  wingName: string; // e.g., 'Entrepreneurship', 'Education', 'General', 'Dawah'
  content: string;
  mediaUrls: string[]; // Cloudinary image or video URLs
  likes: Schema.Types.ObjectId[]; // Array of User IDs who liked
  comments: {
    commenterId: Schema.Types.ObjectId;
    comment: string;
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    wingName: { type: String, required: true, default: "General" },
    content: { type: String, required: true, maxlength: 2000 },
    mediaUrls: [{ type: String }],
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    comments: [
      {
        commenterId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        comment: { type: String, required: true, maxlength: 500 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

export const Post = model<IPost>("Post", PostSchema);
