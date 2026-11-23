import { z } from 'zod';

export const updateProfileSchema = z.object({
  fullName: z.string().min(3, 'Full name must be at least 3 characters').optional(),
  profilePicture: z.string().url('Profile picture must be a valid URL').optional(),
  bio: z.string().max(300, 'Bio cannot exceed 300 characters').optional(),
  location: z
    .object({
      district: z.string().min(1, 'District is required'),
      state: z.string().min(1, 'State/Division is required'),
      country: z.string().min(1, 'Country is required'),
    })
    .optional(),
  webProfiles: z
    .array(
      z.object({
        label: z.string().min(1, 'Profile label is required'),
        url: z.string().url('Profile URL must be valid'),
        iconType: z.string().optional(),
      })
    )
    .optional(),
  subjectsOfInterest: z
    .array(
      z.object({
        genre: z.string().min(1, 'Genre is required'),
        subject: z.string().min(1, 'Subject is required'),
      })
    )
    .optional(),
  softwareSkills: z
    .array(
      z.object({
        name: z.string().min(1, 'Software name is required'),
        level: z.number().int().min(1).max(5, 'Skill level must be between 1 and 5'),
      })
    )
    .optional(),
  vocationalSkills: z
    .array(
      z.object({
        genre: z.string().min(1, 'Skill genre is required'),
        skill: z.string().min(1, 'Skill name is required'),
        level: z.number().int().min(1).max(5, 'Skill level must be between 1 and 5'),
      })
    )
    .optional(),
  chart8020Data: z.record(z.string(), z.any()).optional(),
  islamicDevWheelData: z.record(z.string(), z.any()).optional(),
});

export const updateContactSchema = z.object({
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  emails: z.array(z.string().email('Invalid email format')).min(1, 'At least one email is required').optional(),
  isPrivate: z.boolean().optional(),
});

export const directoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  search: z.string().optional(),
  sortBy: z.enum(['fullName', 'createdAt', 'updatedAt']).default('fullName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
