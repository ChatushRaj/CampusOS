import { Router, type Request, type Response } from 'express';
import { and, desc, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { connections, users } from '../../db/schema.js';
import { countRows } from '../../db/helpers.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getPageParams, paginated } from '../../utils/pagination.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { toUserSummary } from '../users/user.mapper.js';
import { notify } from '../../services/notification.service.js';

const idParam = z.object({ id: z.coerce.number().int().positive('That identifier is not valid') });

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

/** Accepted connections for the signed-in user. */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const page = getPageParams(req, 12, 50);
    const viewerId = req.user!.id;
    const where = and(
      eq(connections.status, 'accepted'),
      or(eq(connections.requesterId, viewerId), eq(connections.recipientId, viewerId)),
    )!;

    const [rows, total] = await Promise.all([
      db
        .select()
        .from(connections)
        .where(where)
        .orderBy(desc(connections.respondedAt), desc(connections.id))
        .limit(page.limit)
        .offset(page.skip),
      countRows(connections, where),
    ]);

    const otherIds = rows.map((r) => (r.requesterId === viewerId ? r.recipientId : r.requesterId));
    const people = otherIds.length
      ? await db
          .select(summaryColumns)
          .from(users)
          .where(or(...otherIds.map((id) => eq(users.id, id)))!)
      : [];
    const byId = new Map(people.map((p) => [p.id, p]));

    const items = rows.map((row) => {
      const otherId = row.requesterId === viewerId ? row.recipientId : row.requesterId;
      return { connectionId: row.id, connectedAt: row.respondedAt, user: toUserSummary(byId.get(otherId)) };
    });
    res.json(paginated(items, total, page));
  }),
);

/** Requests waiting on the signed-in user, plus the ones they sent. */
router.get(
  '/requests',
  asyncHandler(async (req: Request, res: Response) => {
    const viewerId = req.user!.id;

    const [incoming, outgoing] = await Promise.all([
      db
        .select({ link: connections, person: summaryColumns })
        .from(connections)
        .innerJoin(users, eq(connections.requesterId, users.id))
        .where(and(eq(connections.recipientId, viewerId), eq(connections.status, 'pending'))!)
        .orderBy(desc(connections.createdAt), desc(connections.id)),
      db
        .select({ link: connections, person: summaryColumns })
        .from(connections)
        .innerJoin(users, eq(connections.recipientId, users.id))
        .where(and(eq(connections.requesterId, viewerId), eq(connections.status, 'pending'))!)
        .orderBy(desc(connections.createdAt), desc(connections.id)),
    ]);

    res.json({
      incoming: incoming.map((r) => ({ id: r.link.id, user: toUserSummary(r.person), createdAt: r.link.createdAt })),
      outgoing: outgoing.map((r) => ({ id: r.link.id, user: toUserSummary(r.person), createdAt: r.link.createdAt })),
    });
  }),
);

router.post(
  '/:id/request',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    const viewerId = req.user!.id;
    if (targetId === viewerId) throw ApiError.badRequest('You cannot connect with yourself.');

    const [target] = await db
      .select({ id: users.id, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);
    if (!target || !target.isActive) throw ApiError.notFound('We could not find that person.');

    const [existing] = await db
      .select()
      .from(connections)
      .where(
        or(
          and(eq(connections.requesterId, viewerId), eq(connections.recipientId, targetId)),
          and(eq(connections.requesterId, targetId), eq(connections.recipientId, viewerId)),
        )!,
      )
      .limit(1);

    if (existing) {
      if (existing.status === 'accepted') throw ApiError.conflict('You are already connected.');
      // They asked first — treat this as an acceptance rather than a duplicate request.
      if (existing.requesterId === targetId) {
        await db
          .update(connections)
          .set({ status: 'accepted', respondedAt: new Date() })
          .where(eq(connections.id, existing.id));
        await notify({
          recipientId: targetId,
          actorId: viewerId,
          type: 'connection_accepted',
          message: 'accepted your connection request',
          link: `/app/people/${viewerId}`,
        });
        return res.json({ status: 'accepted', connectionId: existing.id });
      }
      throw ApiError.conflict('You have already sent a request to this person.');
    }

    const [result] = await db.insert(connections).values({ requesterId: viewerId, recipientId: targetId });
    await notify({
      recipientId: targetId,
      actorId: viewerId,
      type: 'connection_request',
      message: 'sent you a connection request',
      link: `/app/people/${viewerId}`,
    });
    res.status(201).json({ status: 'pending', connectionId: Number(result.insertId) });
  }),
);

router.post(
  '/:id/accept',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [link] = await db.select().from(connections).where(eq(connections.id, id)).limit(1);
    if (!link) throw ApiError.notFound('That request no longer exists.');
    // Only the person who received the request may accept it.
    if (link.recipientId !== req.user!.id) throw ApiError.forbidden('That request is not yours to accept.');
    if (link.status === 'accepted') throw ApiError.conflict('You are already connected.');

    await db.update(connections).set({ status: 'accepted', respondedAt: new Date() }).where(eq(connections.id, id));
    await notify({
      recipientId: link.requesterId,
      actorId: req.user!.id,
      type: 'connection_accepted',
      message: 'accepted your connection request',
      link: `/app/people/${req.user!.id}`,
    });
    res.json({ status: 'accepted', connectionId: id });
  }),
);

/** Declines a pending request, withdraws one you sent, or removes an existing connection. */
router.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [link] = await db.select().from(connections).where(eq(connections.id, id)).limit(1);
    if (!link) throw ApiError.notFound('That connection no longer exists.');
    if (link.requesterId !== req.user!.id && link.recipientId !== req.user!.id) {
      throw ApiError.forbidden('That connection is not yours to change.');
    }
    await db.delete(connections).where(eq(connections.id, id));
    res.status(204).end();
  }),
);

export default router;
