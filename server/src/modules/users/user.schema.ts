import { z } from 'zod';

/** Numeric primary keys arrive as strings in the URL, so they are coerced and bounded. */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('That identifier is not valid'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80).optional(),
  headline: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(600).optional(),
  department: z.string().trim().max(80).optional(),
  graduationYear: z.coerce.number().int().min(1950).max(2100).nullable().optional(),
  rollNumber: z.string().trim().max(24).optional(),
  interests: z.array(z.string().trim().min(1).max(30)).max(12, 'Up to 12 interests').optional(),
});

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  q: z.string().trim().max(80).optional(),
  department: z.string().trim().max(80).optional(),
  graduationYear: z.coerce.number().int().optional(),
  role: z.enum(['student', 'faculty', 'admin']).optional(),
});
