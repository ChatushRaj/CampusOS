import { z } from 'zod';

export const idParamSchema = z.object({ id: z.coerce.number().int().positive('That identifier is not valid') });
export const commentParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  commentId: z.coerce.number().int().positive(),
});

export const createBlogSchema = z.object({
  title: z.string().trim().min(4, 'Give your article a title').max(140),
  body: z.string().trim().min(40, 'Articles need at least 40 characters').max(20000),
  excerpt: z.string().trim().max(300).optional(),
  tags: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => {
      const list = Array.isArray(v) ? v : typeof v === 'string' && v.length ? v.split(',') : [];
      return [...new Set(list.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 6);
    }),
});

export const updateBlogSchema = createBlogSchema.partial();

export const listBlogsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  q: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(30).optional(),
  author: z.coerce.number().int().positive().optional(),
  sort: z.enum(['recent', 'popular']).default('recent'),
});

export const commentSchema = z.object({ body: z.string().trim().min(1, 'Write a comment').max(1000) });

/** ~200 words a minute, the figure most reading-time indicators use. */
export function estimateReadMinutes(body: string): number {
  return Math.max(1, Math.round(body.trim().split(/\s+/).filter(Boolean).length / 200));
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
