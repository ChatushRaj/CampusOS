import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('That identifier is not valid'),
});

export const commentParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  commentId: z.coerce.number().int().positive(),
});

export const createPostSchema = z.object({
  body: z.string().trim().min(1, 'Write something to share').max(3000, 'Keep posts under 3000 characters'),
  visibility: z.enum(['campus', 'connections']).default('campus'),
  tags: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => {
      const list = Array.isArray(v) ? v : typeof v === 'string' && v.length ? v.split(',') : [];
      return [...new Set(list.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 6);
    }),
});

export const updatePostSchema = z.object({
  body: z.string().trim().min(1).max(3000),
});

export const listPostsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  q: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(30).optional(),
  author: z.coerce.number().int().positive().optional(),
  scope: z.enum(['campus', 'connections']).optional(),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Write a comment').max(1000, 'Keep comments under 1000 characters'),
});
