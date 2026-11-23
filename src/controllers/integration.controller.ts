import { Response } from "express";
import { User } from "../models/User.model";
import { Business } from "../models/Business.model";
import { Event } from "../models/Event.model";
import { ApiKeyRequest } from "../middlewares/apiKey.middleware";

// Helper for Express 5 params
const getParam = (param: unknown): string => {
  if (Array.isArray(param)) return String(param[0]);
  return typeof param === "string" ? param : "";
};

// ─── 1. Cross-Platform Member Sync ───────────────────────────────────────────
export const getMemberForIntegration = async (
  req: ApiKeyRequest,
  res: Response
): Promise<void> => {
  try {
    const id = getParam(req.params.id);

    // Look up verified active member
    const user = await User.findOne({
      _id: id,
      status: "Active",
    }).select("-password");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "Active verified member not found.",
      });
      return;
    }

    // Lookup business brands if any
    const business = await Business.findOne({
      userId: user._id,
      subscriptionStatus: "Paid",
    });

    const publishedBrands = business
      ? business.brands
          .filter((b) => b.isPublished)
          .map((b) => ({
            brandName: b.brandName,
            roleInBusiness: b.roleInBusiness,
            customRoleTitle: b.customRoleTitle,
            businessSummary: b.businessSummary,
            servicesOrProducts: b.servicesOrProducts,
            websiteLinks: b.websiteLinks,
          }))
      : [];

    const isContactPrivate = user.contactInfo?.isPrivate ?? true;

    const publicPayload = {
      id: user._id,
      fullName: user.fullName,
      profilePicture: user.profilePicture,
      bio: user.bio,
      wings: user.wings,
      role: user.role,
      status: user.status,
      profileStatus: user.profileStatus,
      webProfiles: user.webProfiles,
      softwareSkills: user.softwareSkills,
      vocationalSkills: user.vocationalSkills,
      subjectsOfInterest: user.subjectsOfInterest,
      brands: publishedBrands,
      contact: isContactPrivate
        ? { isPrivate: true, notice: "Contact info kept private by sister" }
        : {
            isPrivate: false,
            email: user.email,
            phone: user.contactInfo?.phone,
            whatsapp: user.contactInfo?.whatsapp,
          },
      syncedWith: req.apiKey?.name,
      syncedAt: new Date(),
    };

    res.status(200).json({
      success: true,
      data: publicPayload,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 2. Cross-Platform Wings Directory ───────────────────────────────────────
export const getWingsDirectoryForIntegration = async (
  req: ApiKeyRequest,
  res: Response
): Promise<void> => {
  try {
    const definedWings = [
      {
        name: "FaithAndGrowth",
        title: "Faith & Spiritual Growth",
        description: "Islamic personal development, Quranic reflection, and character building.",
      },
      {
        name: "FamilyAndParenting",
        title: "Family & Parenting",
        description: "Nurturing Islamic family life, conscious parenting, and home management.",
      },
      {
        name: "SistersInBusiness",
        title: "Sisters in Business",
        description: "Entrepreneurship, ethical commerce, brand building, and wholesale trade.",
      },
      {
        name: "HealthAndWellness",
        title: "Health & Wellness",
        description: "Holistic well-being, nutrition, mental health, and active living.",
      },
      {
        name: "SkillsExchange",
        title: "Skills Exchange & Professional Development",
        description: "Software skills, vocational expertise, and mentorship.",
      },
      {
        name: "ProjectTasks",
        title: "Projects & Collaborative Tasks",
        description: "Cross-organization initiatives, community volunteer programs, and tasks.",
      },
      {
        name: "General",
        title: "General Sisterhood Community",
        description: "Sisterhood connections, discussions, and open forums.",
      },
    ];

    // Compute active member count per wing
    const wingCounts = await Promise.all(
      definedWings.map(async (wing) => {
        const count = await User.countDocuments({
          status: "Active",
          wings: wing.name,
        });
        return {
          ...wing,
          activeMemberCount: count,
        };
      })
    );

    res.status(200).json({
      success: true,
      partner: req.apiKey?.name,
      data: wingCounts,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 3. Cross-Platform Events ────────────────────────────────────────────────
export const getEventsForIntegration = async (
  req: ApiKeyRequest,
  res: Response
): Promise<void> => {
  try {
    const events = await Event.find({
      isCancelled: false,
      isPast: false,
      date: { $gte: new Date() },
    })
      .select("title description date time locationType locationDetails bannerUrl ticketPrice")
      .sort({ date: 1 });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
