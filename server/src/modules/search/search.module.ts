import { Router, type Request, type Response } from 'express';
import { and, eq, gte, like, ne, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { blogs, jobs, notices, posts, users } from '../../db/schema.js';
import { containsPattern } from '../../utils/pagination.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { toUserSummary } from '../users/user.mapper.js';

const querySchema = z.object({ q: z.string().trim().min(2, 'Type at least two characters').max(80) });

const summaryColumns = {
  id: users.id,
  name: users.name,
  role: users.role,
  headline: users.headline,
  department: users.department,
  graduationYear: users.graduationYear,
  avatarPath: users.avatarPath,
};

const router = Router();
router.use(requireAuth);

/** Cross-table search powering the header search bar. */
router.get(
  '/',
  validate({ query: querySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    // LIKE parameters are bound, never concatenated, so the term cannot alter the query.
    const term = containsPattern(String(req.query.q));
    const limit = 5;

    const [people, postRows, blogRows, jobRows, noticeRows] = await Promise.all([
      db
        .select(summaryColumns)
        .from(users)
        .where(
          and(
            eq(users.isActive, true),
            ne(users.id, req.user!.id),
            or(like(users.name, term), like(users.headline, term), like(users.department, term)),
          )!,
        )
        .limit(limit),
      db
        .select({ post: posts, author: summaryColumns })
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .where(and(like(posts.body, term), eq(posts.visibility, 'campus'))!)
        .limit(limit),
      db
        .select({ id: blogs.id, title: blogs.title })
        .from(blogs)
        .where(and(eq(blogs.published, true), or(like(blogs.title, term), like(blogs.excerpt, term)))!)
        .limit(limit),
      db
        .select({ id: jobs.id, title: jobs.title, company: jobs.company })
        .from(jobs)
        .where(and(gte(jobs.applyBy, new Date()), or(like(jobs.title, term), like(jobs.company, term)))!)
        .limit(limit),
      db
        .select({ id: notices.id, title: notices.title })
        .from(notices)
        .where(or(like(notices.title, term), like(notices.body, term))!)
        .limit(limit),
    ]);

    res.json({
      query: req.query.q,
      results: {
        people: people.map((p) => ({ ...toUserSummary(p)!, href: `/app/people/${p.id}` })),
        posts: postRows.map((r) => ({
          id: r.post.id,
          title: r.post.body.slice(0, 90),
          author: toUserSummary(r.author),
          href: `/app/posts/${r.post.id}`,
        })),
        blogs: blogRows.map((b) => ({ id: b.id, title: b.title, href: `/app/blogs/${b.id}` })),
        jobs: jobRows.map((j) => ({ id: j.id, title: j.title, subtitle: j.company, href: `/app/jobs/${j.id}` })),
        notices: noticeRows.map((n) => ({ id: n.id, title: n.title, href: '/app/notices' })),
      },
    });
  }),
);

export default router;
