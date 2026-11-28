import { Response } from 'express';
import { User, IUser } from '../models/User.model';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { directoryQuerySchema } from '../validations/user.validation';

// ─── Helper: Role-Based Profile Sanitizer ──────────────────────────────────────
export const sanitizeUserProfile = (
  userDoc: IUser | any,
  viewer?: { id: string; role: string }
): any => {
  const user = userDoc.toObject ? userDoc.toObject() : { ...userDoc };

  // Always remove internal credentials
  delete user.password;
  delete user.emailVerificationToken;
  delete user.emailVerificationExpires;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;

  const isAdmin =
    viewer && (viewer.role === 'Admin' || viewer.role === 'SuperAdmin');
  const isOwner = viewer && viewer.id === user._id.toString();

  // If not admin and not owner
  if (!isAdmin && !isOwner) {
    // 1. Always strip private frameworks
    delete user.chart8020Data;
    delete user.islamicDevWheelData;

    // 2. Always strip identity verification details
    delete user.identityVerification;

    // 3. Contact information privacy enforcement
    const isContactPrivate = user.contactInfo?.isPrivate !== false; // defaults to true
    if (isContactPrivate) {
      user.contactInfo = {
        isPrivate: true,
        emails: [],
      };
    } else {
      // If contactInfo is toggled public, Guests still cannot scrape phone numbers
      if (!viewer) {
        user.contactInfo = {
          isPrivate: false,
          emails: [],
        };
      }
    }
  }

  return user;
};

// ─── GET /api/users (Directory with sorting & search) ─────────────────────────
export const getUsersDirectory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const validationResult = directoryQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      res
        .status(400)
        .json({ success: false, errors: validationResult.error.format() });
      return;
    }

    const { page, limit, search, district, skill, sortBy, sortOrder } = validationResult.data;

    // Only active members are shown in public directory
    const queryConditions: any[] = [{ status: 'Active' }];

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      queryConditions.push({
        $or: [
          { fullName: searchRegex },
          { 'location.district': searchRegex },
          { 'location.state': searchRegex },
          { 'location.country': searchRegex },
          { bio: searchRegex },
          { 'subjectsOfInterest.subject': searchRegex },
          { 'subjectsOfInterest.genre': searchRegex },
          { 'vocationalSkills.skill': searchRegex },
          { 'vocationalSkills.genre': searchRegex },
          { 'softwareSkills.name': searchRegex },
        ],
      });
    }

    if (district && district.trim() !== '') {
      const districtRegex = new RegExp(district.trim(), 'i');
      queryConditions.push({
        $or: [
          { 'location.district': districtRegex },
          { 'location.state': districtRegex },
        ],
      });
    }

    if (skill && skill.trim() !== '') {
      const skillRegex = new RegExp(skill.trim(), 'i');
      queryConditions.push({
        $or: [
          { 'vocationalSkills.skill': skillRegex },
          { 'vocationalSkills.genre': skillRegex },
          { 'softwareSkills.name': skillRegex },
          { 'subjectsOfInterest.subject': skillRegex },
          { 'subjectsOfInterest.genre': skillRegex },
        ],
      });
    }

    const query =
      queryConditions.length > 1 ? { $and: queryConditions } : queryConditions[0];

    // Chronological / Alphabetical sorting
    const sortField = sortBy || 'fullName';
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const sortOptions: any = { [sortField]: sortDirection };

    const skip = (page - 1) * limit;
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    const sanitizedData = users.map((u) => sanitizeUserProfile(u, req.user));

    res.status(200).json({
      success: true,
      count: sanitizedData.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: sanitizedData,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// ─── GET /api/users/:id (Single Member Profile with Role Visibility) ─────────
export const getUserProfileById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, message: 'Member profile not found.' });
      return;
    }

    const isAdmin =
      req.user && (req.user.role === 'Admin' || req.user.role === 'SuperAdmin');
    const isOwner = req.user && req.user.id === user._id.toString();

    // If profile is not Active, only owner and admin can view it
    if (user.status !== 'Active' && !isAdmin && !isOwner) {
      res.status(404).json({ success: false, message: 'Member profile is not currently active.' });
      return;
    }

    // If owner, fetch private frameworks as well
    if (isOwner) {
      const ownerUser = await User.findById(id).select(
        '+chart8020Data +islamicDevWheelData'
      );
      if (ownerUser) {
        res.status(200).json({
          success: true,
          data: sanitizeUserProfile(ownerUser, req.user),
        });
        return;
      }
    }

    res.status(200).json({
      success: true,
      data: sanitizeUserProfile(user, req.user),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
