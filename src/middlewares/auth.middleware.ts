import { Request, Response, NextFunction } from 'express';

// Extend Express Request to include user info (if using custom tokens or sessions)
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        role: 'Guest' | 'Member' | 'PaidMember' | 'Admin';
    };
}

// Middleware to check specific roles
export const authorizeRoles = (...allowedRoles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        // Note: In real implementation, req.user will be populated via a token verification middleware (JWT/Better Auth session)
        const userRole = req.body.role || 'Member'; // Placeholder logic for now

        if (!allowedRoles.includes(userRole)) {
            res.status(403).json({
                success: false,
                message: 'Access denied. You do not have the required permission to access this route.'
            });
            return;
        }

        next();
    };
};