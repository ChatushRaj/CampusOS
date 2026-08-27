import { Router, type Request, type Response } from 'express';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { FEEDBACK_CATEGORIES, FEEDBACK_STATUSES, feedback, users } from '../../db/schema.js';
import { countRows } from '../../db/helpers.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getPageParams, paginated } from '../../utils/pagination.js';
import { mediaUrl } from '../../utils/media.js';
import { validate } from '../../middleware/validate.js';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { imageUpload, relativePath } from '../../middleware/upload.js';
import { toUserSummary } from '../users/user.mapper.js';

const idParam = z.object({ id: z.coerce.number().int().positive('That identifier is not valid') });

const feedbackBody = z.object({
  subject: z.string().trim().min(4, 'Summarise the issue').max(140),
  body: z.string().trim().min(10, 'Tell us a little more').max(3000),
  category: z.enum(FEEDBACK_CATEGORIES).default('other'),
});

const authorColumns = {
  id: users.id,
  name: users.name,
  role: users.role,
  headline: users.headline,
  department: users.department,
  graduationYear: users.graduationYear,
  avatarPath: users.avatarPath,
};

const router = Router();
const shots = imageUpload('feedback');
router.use(requireAuth);

router.post(
  '/',
  shots.single('screenshot'),
  validate({ body: feedbackBody }),
  asyncHandler(async (req: Request, res: Response) => {
    await db.insert(feedback).values({
      ...req.body,
      userId: req.user!.id,
      screenshotPath: req.file ? relativePath(req.file) : null,
    });
    res.status(201).json({ message: 'Thanks — your report reached the campus team.' });
  }),
);

router.get(
  '/',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const page = getPageParams(req, 20, 50);
    const where = req.query.status ? eq(feedback.status, String(req.query.status) as 'open') : undefined;

    const base = db
      .select({ report: feedback, author: authorColumns })
      .from(feedback)
      .innerJoin(users, eq(feedback.userId, users.id));

    const [rows, total] = await Promise.all([
      (where ? base.where(where) : base)
        .orderBy(desc(feedback.createdAt), desc(feedback.id))
        .limit(page.limit)
        .offset(page.skip),
      countRows(feedback, where),
    ]);

    const items = rows.map((r) => ({
      id: r.report.id,
      subject: r.report.subject,
      body: r.report.body,
      category: r.report.category,
      status: r.report.status,
      screenshotUrl: mediaUrl(r.report.screenshotPath),
      user: toUserSummary(r.author),
      createdAt: r.report.createdAt,
    }));
    res.json(paginated(items, total, page));
  }),
);

router.patch(
  '/:id',
  requireAdmin,
  validate({ params: idParam, body: z.object({ status: z.enum(FEEDBACK_STATUSES) }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [existing] = await db.select({ id: feedback.id }).from(feedback).where(eq(feedback.id, id)).limit(1);
    if (!existing) throw ApiError.notFound('That report no longer exists.');
    await db.update(feedback).set({ status: req.body.status }).where(eq(feedback.id, id));
    res.json({ id, status: req.body.status });
  }),
);

export default router;
