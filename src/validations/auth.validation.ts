import { z } from 'zod';

export const registerSchema = z.object({
    fullName: z.string().min(3, 'Full name is required'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    profilePicture: z.string().url('Profile picture must be a valid URL'),
    district: z.string().min(1, 'District is required'),
    state: z.string().min(1, 'State is required'),
    country: z.string().min(1, 'Country is required'),
    referredBy: z.string().min(1, 'Referrer name or ID is mandatory for registration'),
    nidOrPassportUrl: z.string().url('NID or Passport URL is required for verification'),
});

export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});