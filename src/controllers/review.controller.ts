import { Request, Response } from "express";
import mongoose from "mongoose";
import { Review } from "../models/Review.model";
import { Business } from "../models/Business.model";
import { User } from "../models/User.model";
import { Product } from "../models/Product.model";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// ─── 1. Get Reviews (GET /api/reviews?targetType=Brand&targetId=...) ───────────
export const getReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetType, targetId, brandId, businessId, productId, status } = req.query;

    const query: Record<string, any> = {};

    if (status) {
      query.status = status;
    } else {
      // By default show published reviews to public
      query.status = { $ne: "REJECTED" };
    }

    if (targetType) {
      query.targetType = targetType;
    }

    const resolvedProductId = (productId || (targetType === "Product" ? targetId : undefined)) as string;
    if (resolvedProductId && mongoose.Types.ObjectId.isValid(resolvedProductId)) {
      query.$or = [
        { productId: new mongoose.Types.ObjectId(resolvedProductId) },
        { targetId: new mongoose.Types.ObjectId(resolvedProductId) },
      ];
    } else {
      const resolvedTargetId = (targetId || brandId) as string;
      if (resolvedTargetId && mongoose.Types.ObjectId.isValid(resolvedTargetId)) {
        query.$or = [
          { targetId: new mongoose.Types.ObjectId(resolvedTargetId) },
          { brandId: new mongoose.Types.ObjectId(resolvedTargetId) },
        ];
      } else if (businessId && mongoose.Types.ObjectId.isValid(businessId as string)) {
        query.businessId = new mongoose.Types.ObjectId(businessId as string);
      }
    }

    const reviews = await Review.find(query)
      .populate("buyerId", "fullName email profilePicture role")
      .sort({ createdAt: -1 });

    const totalCount = reviews.length;
    const avgRating =
      totalCount > 0
        ? Number(
            (
              reviews.reduce((sum, r) => sum + (r.rating || r.productRating || r.brandRating || 5), 0) /
              totalCount
            ).toFixed(1)
          )
        : 5.0;

    res.status(200).json({
      success: true,
      count: totalCount,
      stats: {
        totalReviews: totalCount,
        averageRating: avgRating,
      },
      data: reviews,
      reviews,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 2. Create Review (POST /api/reviews) ───────────────────────────────────────
export const createReview = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required to review." });
      return;
    }

    const {
      targetType = "Brand",
      targetId,
      brandId: inputBrandId,
      productId: inputProductId,
      rating,
      comment,
    } = req.body;

    const numericRating = Number(rating);
    if (!numericRating || numericRating < 1 || numericRating > 5) {
      res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
      return;
    }

    if (!comment || typeof comment !== "string" || !comment.trim()) {
      res.status(400).json({ success: false, message: "Review comment is required." });
      return;
    }

    const isProductReview =
      targetType === "Product" ||
      Boolean(inputProductId) ||
      Boolean(targetId && !inputBrandId && targetType !== "Brand");

    const effectiveProductId =
      inputProductId || (isProductReview ? targetId : undefined);

    const reviewer = await User.findById(userId);
    const reviewerName = reviewer?.fullName || "Sister Member";
    const objectBuyerId = new mongoose.Types.ObjectId(userId);

    // ── CASE A: Product Review ──
    if (isProductReview && effectiveProductId) {
      if (!mongoose.Types.ObjectId.isValid(effectiveProductId as string)) {
        res.status(400).json({ success: false, message: "Valid product ID is required." });
        return;
      }

      const product = await Product.findOne({
        _id: new mongoose.Types.ObjectId(effectiveProductId as string),
        isDeleted: false,
      });

      if (!product) {
        res.status(404).json({ success: false, message: "Product not found." });
        return;
      }

      // Guard: Seller cannot review their own product
      if (product.sellerId && product.sellerId.toString() === userId.toString()) {
        res.status(403).json({
          success: false,
          message: "Sellers are not permitted to review their own products.",
        });
        return;
      }

      let resolvedBrandId = inputBrandId;
      let business: any = null;

      if (product.businessId) {
        business = await Business.findById(product.businessId);
        if (business && business.brands && business.brands.length > 0) {
          if (!resolvedBrandId) {
            const matchedBrand =
              business.brands.find(
                (b: any) =>
                  b.brandName?.toLowerCase() === product.brandName?.toLowerCase()
              ) || business.brands[0];
            resolvedBrandId = matchedBrand?._id?.toString();
          }
        }
      }

      const objectProductId = new mongoose.Types.ObjectId(effectiveProductId as string);
      const objectBrandId =
        resolvedBrandId && mongoose.Types.ObjectId.isValid(resolvedBrandId)
          ? new mongoose.Types.ObjectId(resolvedBrandId)
          : undefined;
      const objectBusinessId = product.businessId || business?._id;

      const newReview = await Review.create({
        targetType: "Product",
        targetId: objectProductId,
        productId: objectProductId,
        businessId: objectBusinessId,
        brandId: objectBrandId,
        buyerId: objectBuyerId,
        reviewerName,
        rating: numericRating,
        productRating: numericRating,
        comment: comment.trim(),
        status: "PUBLISHED",
      });

      // Recalculate Product rating & reviews
      const allProductReviews = await Review.find({
        $or: [{ productId: objectProductId }, { targetId: objectProductId }],
        status: "PUBLISHED",
      });

      const totalReviews = allProductReviews.length;
      const newProductAvg =
        totalReviews > 0
          ? Number(
              (
                allProductReviews.reduce(
                  (sum, r) => sum + (r.productRating || r.rating),
                  0
                ) / totalReviews
              ).toFixed(1)
            )
          : numericRating;

      product.productRating = newProductAvg;
      product.totalReviews = totalReviews;
      await product.save();

      // Optionally update business brand testimonials if brand exists
      if (business && objectBrandId) {
        const brand = business.brands.id(objectBrandId);
        if (brand) {
          brand.testimonialsAndReviews.push({
            user: reviewerName,
            comment: comment.trim(),
            rating: numericRating,
          });
          await business.save().catch(() => {});
        }
      }

      res.status(201).json({
        success: true,
        message: "Thank you for supporting this sister product! Your review has been published.",
        data: newReview,
        review: newReview,
        stats: {
          totalReviews,
          averageRating: newProductAvg,
        },
      });
      return;
    }

    // ── CASE B: Brand Review ──
    const resolvedBrandId = inputBrandId || targetId;

    if (!resolvedBrandId || !mongoose.Types.ObjectId.isValid(resolvedBrandId)) {
      res.status(400).json({ success: false, message: "Valid brand ID is required." });
      return;
    }

    // Locate the brand and its parent business
    const business = await Business.findOne({ "brands._id": resolvedBrandId });
    if (!business) {
      res.status(404).json({ success: false, message: "Brand not found." });
      return;
    }

    const brand = business.brands.id(resolvedBrandId);
    if (!brand) {
      res.status(404).json({ success: false, message: "Brand not found in business." });
      return;
    }

    // Guard: brand's own founder cannot review their own brand
    if (business.userId.toString() === userId.toString()) {
      res.status(403).json({
        success: false,
        message: "Founders are not permitted to review their own brand.",
      });
      return;
    }

    // 1. Create or update review in Review collection
    const objectBrandId = new mongoose.Types.ObjectId(resolvedBrandId);

    const newReview = await Review.create({
      targetType: "Brand",
      targetId: objectBrandId,
      brandId: objectBrandId,
      businessId: business._id,
      buyerId: objectBuyerId,
      reviewerName,
      rating: numericRating,
      brandRating: numericRating,
      comment: comment.trim(),
      status: "PUBLISHED",
    });

    // 2. Also push into brand's testimonialsAndReviews array in Business document
    brand.testimonialsAndReviews.push({
      user: reviewerName,
      comment: comment.trim(),
      rating: numericRating,
    });
    await business.save();

    // 3. Compute new stats
    const allBrandReviews = await Review.find({
      $or: [{ targetId: objectBrandId }, { brandId: objectBrandId }],
      status: "PUBLISHED",
    });

    const newAvg =
      allBrandReviews.length > 0
        ? Number(
            (
              allBrandReviews.reduce((sum, r) => sum + r.rating, 0) /
              allBrandReviews.length
            ).toFixed(1)
          )
        : numericRating;

    res.status(201).json({
      success: true,
      message: "Thank you for supporting this sister brand! Your review has been published.",
      data: newReview,
      review: newReview,
      stats: {
        totalReviews: allBrandReviews.length,
        averageRating: newAvg,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── 3. Admin: Update Review Status (PATCH /api/reviews/:id) ───────────────────
export const updateReviewStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id as string)) {
      res.status(400).json({ success: false, message: "Invalid review ID." });
      return;
    }

    const review = await Review.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!review) {
      res.status(404).json({ success: false, message: "Review not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Review status updated to ${status}.`,
      data: review,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
