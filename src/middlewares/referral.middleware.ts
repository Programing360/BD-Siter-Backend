import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User.model';

export const validateReferral = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { referredBy } = req.body;

        // Check if the database is completely empty (First User exception)
        const totalUsers = await User.countDocuments();
        if (totalUsers === 0) {
            // First user can register without a referrer
            next();
            return;
        }

        if (!referredBy) {
            res.status(400).json({ success: false, message: 'Referral is mandatory for registration.' });
            return;
        }

        // Check if the referrer exists in the database
        const referrerExists = await User.findOne({ fullName: referredBy });
        if (!referrerExists) {
            res.status(400).json({
                success: false,
                message: 'Invalid referral. The person who referred you must be a registered member of BDSisters.org.'
            });
            return;
        }

        next();
    } catch (error) {
        res.status(500).json({ success: false, message: (error as Error).message });
    }
};