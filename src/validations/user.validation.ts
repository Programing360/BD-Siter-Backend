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
      z
        .object({
          label: z.string().optional(),
          platform: z.string().optional(),
          url: z.string().url('Profile URL must be valid'),
          iconType: z.string().optional(),
        })
        .refine((data) => !!(data.label || data.platform), {
          message: 'Profile label or platform is required',
        })
        .transform((data) => ({
          label: data.label || data.platform || 'Website',
          url: data.url,
          iconType: data.iconType || data.platform || 'Globe',
        }))
    )
    .optional(),
  subjectsOfInterest: z
    .array(
      z.union([
        z.string().transform((subject) => ({ genre: 'General', subject })),
        z.object({
          genre: z.string().default('General'),
          subject: z.string().min(1, 'Subject is required'),
        }),
      ])
    )
    .optional(),
  softwareSkills: z
    .array(
      z.union([
        z.string().transform((name) => ({ name, level: 3 })),
        z
          .object({
            name: z.string().min(1, 'Software name is required'),
            level: z.coerce.number().transform((val) => {
              if (val > 5) return Math.min(5, Math.max(1, Math.round(val / 20)));
              return Math.min(5, Math.max(1, Math.round(val)));
            }),
          }),
      ])
    )
    .optional(),
  vocationalSkills: z
    .array(
      z.union([
        z.string().transform((skill) => ({ genre: 'General', skill, level: 3 })),
        z
          .object({
            genre: z.string().optional().default('General'),
            skill: z.string().optional(),
            name: z.string().optional(),
            level: z.coerce.number().transform((val) => {
              if (val > 5) return Math.min(5, Math.max(1, Math.round(val / 20)));
              return Math.min(5, Math.max(1, Math.round(val)));
            }),
          })
          .refine((data) => !!(data.skill || data.name), {
            message: 'Skill name is required',
          })
          .transform((data) => ({
            genre: data.genre || 'General',
            skill: data.skill || data.name || '',
            level: data.level,
          })),
      ])
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
  district: z.string().optional(),
  skill: z.string().optional(),
  sortBy: z.enum(['fullName', 'createdAt', 'updatedAt']).default('fullName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
