import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

// Ensure .env is loaded
const candidateEnvPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "bdsisters-backend", ".env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../.env"),
];
const envPath = candidateEnvPaths.find((p) => fs.existsSync(p));
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

import initialHomeData from "./initialHomeData.json";
import { User } from "../models/User.model";
import { CmsBlock } from "../models/CmsBlock.model";
import { CmsPage } from "../models/CmsPage.model";
import { MasterLookup } from "../models/MasterLookup.model";
import { Business } from "../models/Business.model";
import { Product } from "../models/Product.model";
import { Post } from "../models/Post.model";
import { ForumCategory } from "../models/ForumCategory.model";
import { DEFAULT_FORUM_CATEGORIES } from "../controllers/forum.controller";
import { Event } from "../models/Event.model";
import { ResourceLibrary } from "../models/ResourceLibrary.model";

export async function seedIfEmpty(): Promise<void> {
  console.log("Checking database collections for initial seeding...");

  // 1. Locate or create SuperAdmin user
  let admin = await User.findOne({
    role: { $in: ["SuperAdmin", "Admin"] },
  });

  if (!admin) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("AdminPassword123!", salt);

    admin = await User.create({
      fullName: "BDSisters SuperAdmin",
      email: "admin@bdsisters.org",
      password: hashedPassword,
      role: "SuperAdmin",
      status: "Active",
      profileStatus: "Active",
      isEmailVerified: true,
      referralCode: "BDS-ADMIN-SEED",
      location: {
        district: "Dhaka",
        state: "Dhaka",
        country: "Bangladesh",
      },
      contactInfo: {
        emails: ["admin@bdsisters.org"],
        isPrivate: false,
      },
      identityVerification: {
        nidOrPassportUrl: "https://bdsisters.org/docs/admin-verification.pdf",
        verificationStatus: "Approved",
        auditLog: [],
      },
      bio: "Founding administrator and platform overseer for BDSisters.org under Muhsina Organization.",
    });
    console.log("Created initial SuperAdmin user:", admin.email);
  }

  // 2. Seed CmsBlock collection
  const cmsBlockCount = await CmsBlock.countDocuments();
  if (cmsBlockCount === 0) {
    const blocksToInsert = (initialHomeData.cmsBlocks as any[]).map((b: any) => ({
      ...b,
      lastEditedBy: admin?._id,
    }));
    await CmsBlock.insertMany(blocksToInsert);
    console.log(`Seeded ${blocksToInsert.length} CmsBlock documents.`);
  }

  // 3. Seed MasterLookup collection
  const lookupCount = await MasterLookup.countDocuments();
  if (lookupCount === 0) {
    await MasterLookup.insertMany(initialHomeData.masterLookups);
    console.log(`Seeded ${initialHomeData.masterLookups.length} MasterLookup items.`);
  }

  // 4. Seed Business and Product collections
  // Clean up any existing duplicate business profiles for admin or identical brand sets
  const adminBusinesses = await Business.find({ userId: admin._id }).sort({ createdAt: 1 });
  if (adminBusinesses.length > 1) {
    const [, ...duplicates] = adminBusinesses;
    for (const dup of duplicates) {
      await Business.deleteOne({ _id: dup._id });
    }
    console.log(`Cleaned up ${duplicates.length} duplicate admin business profiles.`);
  }

  // Deduplicate any other business profiles with identical brand lists
  const allBusinesses = await Business.find();
  const seenBrandFingerprints = new Set<string>();
  for (const b of allBusinesses) {
    const fp = (b.brands || [])
      .map((br) => (br.brandName || "").trim().toLowerCase())
      .sort()
      .join("|");
    if (fp && seenBrandFingerprints.has(fp)) {
      await Business.deleteOne({ _id: b._id });
      console.log(`Deleted duplicate business profile ${b._id}`);
    } else if (fp) {
      seenBrandFingerprints.add(fp);
    }
  }

  let business = await Business.findOne({ userId: admin._id });
  if (!business) {
    business = await Business.create({
      userId: admin._id,
      subscriptionStatus: "Paid",
      subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      brands: [
        {
          brandName: "Rawdah Botanicals",
          roleInBusiness: "Founder",
          businessSummary: "Organic skincare and botanical herbal wellness mists crafted for sisters.",
          servicesOrProducts: ["Herbal Mist", "Face Oils"],
          isPublished: true,
        },
        {
          brandName: "Haya & Co.",
          roleInBusiness: "Founder",
          businessSummary: "Luxury chiffon hijabs, modest wear, and ethical accessories.",
          servicesOrProducts: ["Chiffon Hijabs", "Abayas"],
          isPublished: true,
        },
        {
          brandName: "Fitrah Nurture",
          roleInBusiness: "Founder",
          businessSummary: "Homeschooling curriculum consultation and parenting frameworks.",
          servicesOrProducts: ["Curriculum Strategy", "Parenting Handouts"],
          isPublished: true,
        },
        {
          brandName: "Qalam & Ink Studio",
          roleInBusiness: "Founder",
          businessSummary: "Handbound Islamic journals, planners, and calligraphy stationery.",
          servicesOrProducts: ["Journals", "Planners"],
          isPublished: true,
        },
        {
          brandName: "Shifaa Holistic",
          roleInBusiness: "Founder",
          businessSummary: "Cold-pressed black seed oil and pure Sundarbans raw honey.",
          servicesOrProducts: ["Black Seed Oil", "Raw Honey"],
          isPublished: true,
        },
        {
          brandName: "Noor Studio",
          roleInBusiness: "Founder",
          businessSummary: "Halal brand design, typography, packaging, and digital assets.",
          servicesOrProducts: ["Brand Identity", "Packaging Design"],
          isPublished: true,
        },
      ],
    });
    console.log("Seeded default verified BusinessProfile with 6 brands.");
  }

  const productCount = await Product.countDocuments();
  if (productCount === 0 && business) {
    const productsToInsert = (initialHomeData.featuredProducts as any[]).map((p: any) => ({
      ...p,
      businessId: business?._id,
      sellerId: admin?._id,
      price: p.salePrice,
    }));
    await Product.insertMany(productsToInsert);
    console.log(`Seeded ${productsToInsert.length} Featured Products.`);
  }

  // 5. Seed Forum Categories
  const forumCatCount = await ForumCategory.countDocuments();
  if (forumCatCount === 0) {
    await ForumCategory.insertMany(DEFAULT_FORUM_CATEGORIES);
    console.log(`Seeded ${DEFAULT_FORUM_CATEGORIES.length} default ForumCategory items.`);
  }

  // 6. Seed Forum Posts
  const forumCount = await Post.countDocuments();
  if (forumCount === 0) {
    const postsToInsert = (initialHomeData.forumPosts as any[]).map((f: any) => ({
      ...f,
      authorId: admin?._id,
    }));
    await Post.insertMany(postsToInsert);
    console.log(`Seeded ${postsToInsert.length} Forum Posts.`);
  }

  // 6. Seed Events
  const eventCount = await Event.countDocuments();
  if (eventCount === 0) {
    const eventsToInsert = (initialHomeData.upcomingEvents as any[]).map((e: any) => ({
      ...e,
      organizerId: admin?._id,
    }));
    await Event.insertMany(eventsToInsert);
    console.log(`Seeded ${eventsToInsert.length} Upcoming Events.`);
  }

  // 7. Seed Resources
  const resourceCount = await ResourceLibrary.countDocuments();
  if (resourceCount === 0) {
    const resourcesToInsert = (initialHomeData.curatedResources as any[]).map((r: any) => ({
      ...r,
      authorId: admin?._id,
    }));
    await ResourceLibrary.insertMany(resourcesToInsert);
    console.log(`Seeded ${resourcesToInsert.length} Curated Resources.`);
  }

  // 8. Seed Core Public Navigation Pages (CmsPage)
  const CORE_PUBLIC_NAV_PAGES = [
    {
      slug: "home",
      title: "Home",
      navLabel: "Home",
      navOrder: 0,
      showInHeader: true,
      showInNav: true,
      isPublished: true,
      metaDescription: "BDSisters.org - Official portal for commerce and community under Muhsina Organization.",
      blocks: [],
    },
    {
      slug: "who-we-are",
      title: "Who We Are",
      navLabel: "Who We Are",
      navOrder: 1,
      showInHeader: true,
      showInNav: true,
      isPublished: true,
      metaDescription: "Learn about BDSisters.org, our mission, vision, and organizational values.",
      blocks: [],
    },
    {
      slug: "shops",
      title: "Shops",
      navLabel: "Shops",
      navOrder: 2,
      showInHeader: true,
      showInNav: true,
      isPublished: true,
      metaDescription: "Curated Halal marketplace supporting sister-owned enterprises.",
      blocks: [],
    },
    {
      slug: "forums",
      title: "Forums",
      navLabel: "Forums",
      navOrder: 3,
      showInHeader: true,
      showInNav: true,
      isPublished: true,
      metaDescription: "Moderated discussions on faith, business, parenting, health, and skills exchange.",
      blocks: [],
    },
    {
      slug: "profiles",
      title: "Sister Profiles",
      navLabel: "Sister Profiles",
      navOrder: 4,
      showInHeader: true,
      showInNav: true,
      isPublished: true,
      metaDescription: "Explore profiles of verified sisters and collaborate across industries.",
      blocks: [],
    },
    {
      slug: "events",
      title: "Events & Workshops",
      navLabel: "Events & Workshops",
      navOrder: 5,
      showInHeader: false,
      showInNav: false,
      isPublished: true,
      metaDescription: "Live masterclasses, community circles, and sister workshops.",
      blocks: [],
    },
    {
      slug: "resources",
      title: "Resource Library",
      navLabel: "Resource Library",
      navOrder: 6,
      showInHeader: false,
      showInNav: false,
      isPublished: true,
      metaDescription: "Downloadable business toolkits, legal guides, and parenting cheat sheets.",
      blocks: [],
    },
    {
      slug: "wings",
      title: "Sister Wings",
      navLabel: "Sister Wings",
      navOrder: 7,
      showInHeader: false,
      showInNav: false,
      isPublished: true,
      metaDescription: "Specialized initiatives: CoP, TSPP, MIDJ, and The Hut.",
      blocks: [],
    },
    {
      slug: "contact",
      title: "Get in Touch",
      navLabel: "Get in Touch",
      navOrder: 8,
      showInHeader: false,
      showInNav: false,
      isPublished: true,
      metaDescription: "Connect directly with our team for questions, partnerships, or support.",
      blocks: [],
    },
  ];

  for (const page of CORE_PUBLIC_NAV_PAGES) {
    const existing = await CmsPage.findOne({ slug: page.slug });
    if (!existing) {
      await CmsPage.create({
        ...page,
        lastEditedBy: admin?._id,
      });
      console.log(`Seeded CmsPage: /${page.slug} (${page.title})`);
    }
  }

  console.log("Initial database seeding check complete!");
}

// Standalone execution
if (require.main === module) {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/bdsisters";
  mongoose
    .connect(mongoUri)
    .then(async () => {
      console.log("Connected to MongoDB for standalone seeding.");
      await seedIfEmpty();
      await mongoose.disconnect();
      console.log("MongoDB disconnected. Seeding finished cleanly.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seeding failed with error:", err);
      process.exit(1);
    });
}
