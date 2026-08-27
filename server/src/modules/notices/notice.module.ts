import { Router, type Request, type Response } from 'express';
import { and, desc, eq, gte, isNull, like, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { NOTICE_CATEGORIES, NOTICE_PRIORITIES, notices, users } from '../../db/schema.js';
import { countRows } from '../../db/helpers.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { containsPattern, getPageParams, paginated } from '../../utils/pagination.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireStaff } from '../../middleware/auth.js';
import { toUserSummary } from '../users/user.mapper.js';
import { notifyMany } from '../../services/notification.service.js';

const idParam = z.object({ id: z.coerce.number().int().positive('That identifier is not valid') });

const noticeBody = z.object({
  title: z.string().trim().min(4, 'Give the notice a title').max(160),
  body: z.string().trim().min(1, 'Add the notice details').max(5000),
  category: z.enum(NOTICE_CATEGORIES).default('general'),
  priority: z.enum(NOTICE_PRIORITIES).default('normal'),
  attachmentUrl: z.string().url('Enter a valid link').nullish().or(z.literal('')),
  expiresAt: z.coerce.date().nullish(),
  pinned: z.coerce.boolean().default(false),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  q: z.string().trim().max(100).optional(),
  category: z.enum(NOTICE_CATEGORIES).optional(),
  priority: z.enum(NOTICE_PRIORITIES).optional(),
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

function mapNotice(row: any, viewerRole: string, viewerId: number) {
  const n = row.notice;
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    category: n.category,
    priority: n.priority,
    attachmentUrl: n.attachmentUrl,
    expiresAt: n.expiresAt,
    pinned: n.pinned,
    postedBy: toUserSummary(row.author),
    canManage: viewerRole === 'admin' || n.postedBy === viewerId,
    createdAt: n.createdAt,
  };
}

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const page = getPageParams(req, 10, 50);
    // An expired notice drops off the board without anyone deleting it.
    const filters = [or(isNull(notices.expiresAt), gte(notices.expiresAt, new Date()))!];
    if (req.query.category) filters.push(eq(notices.category, req.query.category as 'general'));
    if (req.query.priority) filters.push(eq(notices.priority, req.query.priority as 'normal'));
    if (req.query.q) {
      const term = containsPattern(String(req.query.q));
      const match = or(like(notices.title, term), like(notices.body, term));
      if (match) filters.push(match);
    }

    const where = and(...filters)!;
    const [rows, total] = await Promise.all([
      db
        .select({ notice: notices, author: authorColumns })
        .from(notices)
        .innerJoin(users, eq(notices.postedBy, users.id))
        .where(where)
        .orderBy(desc(notices.pinned), desc(notices.createdAt), desc(notices.id))
        .limit(page.limit)
        .offset(page.skip),
      countRows(notices, where),
    ]);

    res.json(
      paginated(
        rows.map((r) => mapNotice(r, req.user!.role, req.user!.id)),
        total,
        page,
      ),
    );
  }),
);

router.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db
      .select({ notice: notices, author: authorColumns })
      .from(notices)
      .innerJoin(users, eq(notices.postedBy, users.id))
      .where(eq(notices.id, Number(req.params.id)))
      .limit(1);
    if (!row) throw ApiError.notFound('That notice no longer exists.');
    res.json({ notice: mapNotice(row, req.user!.role, req.user!.id) });
  }),
);

router.post(
  '/',
  requireStaff,
  validate({ body: noticeBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { attachmentUrl, expiresAt, ...rest } = req.body;
    const [result] = await db.insert(notices).values({
      ...rest,
      attachmentUrl: attachmentUrl || null,
      expiresAt: expiresAt ?? null,
      postedBy: req.user!.id,
    });
    const id = Number(result.insertId);

    // An urgent notice reaches everyone; routine ones sit on the board.
    if (rest.priority === 'urgent') {
      const recipients = await db.select({ id: users.id }).from(users).where(eq(users.isActive, true));
      await notifyMany(
        recipients.map((r) => r.id),
        {
          actorId: req.user!.id,
          type: 'notice_posted',
          message: `Urgent notice: ${rest.title}`,
          link: '/app/notices',
        },
      );
    }

    const [row] = await db
      .select({ notice: notices, author: authorColumns })
      .from(notices)
      .innerJoin(users, eq(notices.postedBy, users.id))
      .where(eq(notices.id, id))
      .limit(1);
    res.status(201).json({ notice: mapNotice(row!, req.user!.role, req.user!.id) });
  }),
);

router.patch(
  '/:id',
  requireStaff,
  validate({ params: idParam, body: noticeBody.partial() }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [existing] = await db.select({ postedBy: notices.postedBy }).from(notices).where(eq(notices.id, id)).limit(1);
    if (!existing) throw ApiError.notFound('That notice no longer exists.');
    if (existing.postedBy !== req.user!.id && req.user!.role !== 'admin') {
      throw ApiError.forbidden('You can only edit notices you posted.');
    }

    if (Object.keys(req.body).length) await db.update(notices).set(req.body).where(eq(notices.id, id));
    const [row] = await db
      .select({ notice: notices, author: authorColumns })
      .from(notices)
      .innerJoin(users, eq(notices.postedBy, users.id))
      .where(eq(notices.id, id))
      .limit(1);
    res.json({ notice: mapNotice(row!, req.user!.role, req.user!.id) });
  }),
);

router.delete(
  '/:id',
  requireStaff,
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [existing] = await db.select({ postedBy: notices.postedBy }).from(notices).where(eq(notices.id, id)).limit(1);
    if (!existing) throw ApiError.notFound('That notice no longer exists.');
    if (existing.postedBy !== req.user!.id && req.user!.role !== 'admin') {
      throw ApiError.forbidden('You can only delete notices you posted.');
    }
    await db.delete(notices).where(eq(notices.id, id));
    res.status(204).end();
  }),
);

export default router;
