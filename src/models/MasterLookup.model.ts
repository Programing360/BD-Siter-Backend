import mongoose, { Schema, Document } from "mongoose";

export type LookupType =
    | "subjects"
    | "software"
    | "vocationalSkills"
    | "socialIcons"
    | "businessRoles";

export interface IMasterLookup extends Document {
    type: LookupType;
    genreOrCategory: string;
    name: string;
    iconUrl?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const MasterLookupSchema = new Schema<IMasterLookup>(
    {
        type: {
            type: String,
            enum: ["subjects", "software", "vocationalSkills", "socialIcons", "businessRoles"],
            required: true,
            index: true,
        },
        genreOrCategory: {
            type: String,
            trim: true,
            default: "General",
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        iconUrl: {
            type: String,
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

// Prevent exact duplicate entries within the same type
MasterLookupSchema.index({ type: 1, name: 1 }, { unique: true });

export const MasterLookup = mongoose.model<IMasterLookup>(
    "MasterLookup",
    MasterLookupSchema
);