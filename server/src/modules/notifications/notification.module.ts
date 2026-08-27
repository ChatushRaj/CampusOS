import { Router, type Request, type Response } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { notifications, users } from '../../db/schema.js';
import { countRows } from '../../db/helpers.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getPageParams, paginated } from '../../utils/pagination.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { toUserSummary } from '../users/user.mapper.js';

const idParam = z.object({ id: z.coerce.number().int().positive('That identifier is not valid') });

const actorColumns = {
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

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const page = getPageParams(req, 15, 50);
    const viewerId = req.user!.id;
    const where =
      req.query.unread === 'true'
        ? and(eq(notifications.recipientId, viewerId), eq(notifications.isRead, false))!
        : eq(notifications.recipientId, viewerId);

    const [rows, total, unreadCount] = await Promise.all([
      db
        .select({ notification: notifications, actor: actorColumns })
        .from(notifications)
        // LEFT JOIN because the actor may have deleted their account.
        .leftJoin(users, eq(notifications.actorId, users.id))
        .where(where)
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(page.limit)
        .offset(page.skip),
      countRows(notifications, where),
      countRows(notifications, and(eq(notifications.recipientId, viewerId), eq(notifications.isRead, false))!),
    ]);

    const items = rows.map((r) => ({
      id: r.notification.id,
      type: r.notification.type,
      message: r.notification.message,
      link: r.notification.link,
      read: r.notification.isRead,
      actor: toUserSummary(r.actor),
      createdAt: r.notification.createdAt,
    }));
    res.json({ ...paginated(items, total, page), unreadCount });
  }),
);

router.get(
  '/unread-count',
  asyncHandler(async (req: Request, res: Response) => {
    const unreadCount = await countRows(
      notifications,
      and(eq(notifications.recipientId, req.user!.id), eq(notifications.isRead, false))!,
    );
    res.json({ unreadCount });
  }),
);

router.post(
  '/:id/read',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    // Scoped to the recipient, so one person cannot mark another's notification read.
    const [row] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.recipientId, req.user!.id))!)
      .limit(1);
    if (!row) throw ApiError.notFound('That notification no longer exists.');

    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
    res.json({ id, read: true });
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req: Request, res: Response) => {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.recipientId, req.user!.id), eq(notifications.isRead, false))!);
    res.json({ unreadCount: 0 });
  }),
);

export default router;
