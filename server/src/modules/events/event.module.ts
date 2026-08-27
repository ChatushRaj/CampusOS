import { Router, type Request, type Response } from 'express';
import { and, asc, desc, eq, gte, like, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { EVENT_CATEGORIES, RSVP_STATUSES, eventRsvps, events, users } from '../../db/schema.js';
import { countRows } from '../../db/helpers.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { containsPattern, getPageParams, paginated } from '../../utils/pagination.js';
import { mediaUrl } from '../../utils/media.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireStaff } from '../../middleware/auth.js';
import { imageUpload, relativePath, removeFile } from '../../middleware/upload.js';
import { toUserSummary } from '../users/user.mapper.js';

const idParam = z.object({ id: z.coerce.number().int().positive('That identifier is not valid') });

const eventBase = z.object({
  title: z.string().trim().min(4, 'Give the event a title').max(160),
  description: z.string().trim().max(5000).optional(),
  category: z.enum(EVENT_CATEGORIES).default('other'),
  startsAt: z.coerce.date({ invalid_type_error: 'Choose a start date and time' }),
  endsAt: z.coerce.date().nullish(),
  venue: z.string().trim().min(2, 'Where is it happening?').max(160),
  registrationUrl: z.string().url('Enter a valid link').nullish().or(z.literal('')),
  capacity: z.coerce.number().int().min(0).nullish(),
});

const eventBody = eventBase.refine((v) => !v.endsAt || v.endsAt >= v.startsAt, {
  message: 'The end time must be after the start time',
  path: ['endsAt'],
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  q: z.string().trim().max(100).optional(),
  category: z.enum(EVENT_CATEGORIES).optional(),
  when: z.enum(['upcoming', 'past']).default('upcoming'),
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

function mapEvent(row: any, rsvps: Map<number, string>, viewerRole: string, viewerId: number) {
  const e = row.event;
  return {
    id: e.id,
    title: e.title,
    description: e.description ?? '',
    category: e.category,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    venue: e.venue,
    coverUrl: mediaUrl(e.coverPath),
    registrationUrl: e.registrationUrl,
    capacity: e.capacity,
    goingCount: e.goingCount,
    interestedCount: e.interestedCount,
    organiser: toUserSummary(row.author),
    myRsvp: rsvps.get(e.id) ?? null,
    canManage: viewerRole === 'admin' || e.organiserId === viewerId,
    createdAt: e.createdAt,
  };
}

async function myRsvps(viewerId: number, ids: number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ eventId: eventRsvps.eventId, status: eventRsvps.status })
    .from(eventRsvps)
    .where(and(eq(eventRsvps.userId, viewerId), sql`${eventRsvps.eventId} in (${sql.join(ids, sql`, `)})`)!);
  return new Map(rows.map((r) => [r.eventId, r.status as string]));
}

const router = Router();
const covers = imageUpload('events');
router.use(requireAuth);

router.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const page = getPageParams(req, 9, 30);
    const now = new Date();
    const upcoming = req.query.when !== 'past';

    const filters = [upcoming ? gte(events.startsAt, now) : lt(events.startsAt, now)];
    if (req.query.category) filters.push(eq(events.category, req.query.category as 'other'));
    if (req.query.q) {
      const term = containsPattern(String(req.query.q));
      const match = or(like(events.title, term), like(events.description, term), like(events.venue, term));
      if (match) filters.push(match);
    }

    const where = and(...filters)!;
    const [rows, total] = await Promise.all([
      db
        .select({ event: events, author: authorColumns })
        .from(events)
        .innerJoin(users, eq(events.organiserId, users.id))
        .where(where)
        .orderBy(upcoming ? asc(events.startsAt) : desc(events.startsAt), asc(events.id))
        .limit(page.limit)
        .offset(page.skip),
      countRows(events, where),
    ]);

    const rsvps = await myRsvps(
      req.user!.id,
      rows.map((r) => r.event.id),
    );
    res.json(
      paginated(
        rows.map((r) => mapEvent(r, rsvps, req.user!.role, req.user!.id)),
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
    const id = Number(req.params.id);
    const [row] = await db
      .select({ event: events, author: authorColumns })
      .from(events)
      .innerJoin(users, eq(events.organiserId, users.id))
      .where(eq(events.id, id))
      .limit(1);
    if (!row) throw ApiError.notFound('That event no longer exists.');
    res.json({ event: mapEvent(row, await myRsvps(req.user!.id, [id]), req.user!.role, req.user!.id) });
  }),
);

router.post(
  '/',
  requireStaff,
  covers.single('cover'),
  validate({ body: eventBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { registrationUrl, endsAt, capacity, ...rest } = req.body;
    const [result] = await db.insert(events).values({
      ...rest,
      endsAt: endsAt ?? null,
      capacity: capacity ?? null,
      registrationUrl: registrationUrl || null,
      organiserId: req.user!.id,
      coverPath: req.file ? relativePath(req.file) : null,
    });

    const [row] = await db
      .select({ event: events, author: authorColumns })
      .from(events)
      .innerJoin(users, eq(events.organiserId, users.id))
      .where(eq(events.id, Number(result.insertId)))
      .limit(1);
    res.status(201).json({ event: mapEvent(row!, new Map(), req.user!.role, req.user!.id) });
  }),
);

router.patch(
  '/:id',
  requireStaff,
  covers.single('cover'),
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [existing] = await db
      .select({ organiserId: events.organiserId, coverPath: events.coverPath })
      .from(events)
      .where(eq(events.id, id))
      .limit(1);
    if (!existing) throw ApiError.notFound('That event no longer exists.');
    if (existing.organiserId !== req.user!.id && req.user!.role !== 'admin') {
      throw ApiError.forbidden('You can only edit events you organise.');
    }

    const parsed = eventBase.partial().safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? 'Check the form.');

    const patch: Record<string, unknown> = { ...parsed.data };
    if (req.file) {
      removeFile(existing.coverPath);
      patch.coverPath = relativePath(req.file);
    }
    if (Object.keys(patch).length) await db.update(events).set(patch).where(eq(events.id, id));

    const [row] = await db
      .select({ event: events, author: authorColumns })
      .from(events)
      .innerJoin(users, eq(events.organiserId, users.id))
      .where(eq(events.id, id))
      .limit(1);
    res.json({ event: mapEvent(row!, await myRsvps(req.user!.id, [id]), req.user!.role, req.user!.id) });
  }),
);

router.delete(
  '/:id',
  requireStaff,
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [existing] = await db
      .select({ organiserId: events.organiserId, coverPath: events.coverPath })
      .from(events)
      .where(eq(events.id, id))
      .limit(1);
    if (!existing) throw ApiError.notFound('That event no longer exists.');
    if (existing.organiserId !== req.user!.id && req.user!.role !== 'admin') {
      throw ApiError.forbidden('You can only delete events you organise.');
    }
    removeFile(existing.coverPath);
    await db.delete(events).where(eq(events.id, id)); // RSVPs cascade.
    res.status(204).end();
  }),
);

/** Sets, switches or clears an RSVP, keeping both counters consistent in one transaction. */
router.post(
  '/:id/rsvp',
  validate({ params: idParam, body: z.object({ status: z.enum(RSVP_STATUSES).nullable() }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const eventId = Number(req.params.id);
    const userId = req.user!.id;
    const next = req.body.status as 'going' | 'interested' | null;

    const result = await db.transaction(async (tx) => {
      const [event] = await tx.select().from(events).where(eq(events.id, eventId)).limit(1);
      if (!event) throw ApiError.notFound('That event no longer exists.');

      const [existing] = await tx
        .select({ status: eventRsvps.status })
        .from(eventRsvps)
        .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId))!)
        .limit(1);

      let going = event.goingCount;
      let interested = event.interestedCount;
      const drop = (s: string) => {
        if (s === 'going') going = Math.max(0, going - 1);
        else interested = Math.max(0, interested - 1);
      };

      if (existing) drop(existing.status);

      let finalStatus: 'going' | 'interested' | null = null;
      // Tapping the active choice again withdraws the RSVP.
      if (!next || existing?.status === next) {
        if (existing)
          await tx.delete(eventRsvps).where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId))!);
      } else {
        if (next === 'going' && event.capacity !== null && going >= event.capacity) {
          throw ApiError.badRequest('This event is at capacity.');
        }
        if (next === 'going') going += 1;
        else interested += 1;
        await tx
          .insert(eventRsvps)
          .values({ eventId, userId, status: next })
          .onDuplicateKeyUpdate({ set: { status: next } });
        finalStatus = next;
      }

      await tx.update(events).set({ goingCount: going, interestedCount: interested }).where(eq(events.id, eventId));
      return { myRsvp: finalStatus, goingCount: going, interestedCount: interested };
    });

    res.json(result);
  }),
);

export default router;
