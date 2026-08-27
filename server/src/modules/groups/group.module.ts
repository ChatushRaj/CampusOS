import { Router, type Request, type Response } from 'express';
import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { GROUP_CATEGORIES, groupDiscussions, groupMembers, groupReplies, studyGroups, users } from '../../db/schema.js';
import { countRows } from '../../db/helpers.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { containsPattern, getPageParams, paginated } from '../../utils/pagination.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rateLimit.js';
import { toUserSummary } from '../users/user.mapper.js';

const idParam = z.object({ id: z.coerce.number().int().positive('That identifier is not valid') });

const discussionParams = z.object({
  id: z.coerce.number().int().positive(),
  discussionId: z.coerce.number().int().positive(),
});

const groupBody = z.object({
  name: z.string().trim().min(3, 'Give the group a name').max(80),
  description: z.string().trim().max(600).optional(),
  category: z.enum(GROUP_CATEGORIES).default('other'),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  q: z.string().trim().max(80).optional(),
  category: z.enum(GROUP_CATEGORIES).optional(),
  mine: z.coerce.boolean().optional(),
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

function mapGroup(
  row: { group: typeof studyGroups.$inferSelect; owner: unknown },
  joined: Set<number>,
  viewerId: number,
) {
  const g = row.group;
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    category: g.category,
    memberCount: g.memberCount,
    owner: toUserSummary(row.owner as never),
    isMember: joined.has(g.id),
    canManage: g.ownerId === viewerId,
    createdAt: g.createdAt,
  };
}

/** Which of these groups has the viewer joined? One query for the whole page. */
async function joinedIds(viewerId: number, ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(and(eq(groupMembers.userId, viewerId), inArray(groupMembers.groupId, ids))!);
  return new Set(rows.map((r) => r.groupId));
}

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const page = getPageParams(req, 12, 40);
    const viewerId = req.user!.id;
    const filters = [];

    if (req.query.category) filters.push(eq(studyGroups.category, req.query.category as 'other'));
    if (req.query.q) {
      const term = containsPattern(String(req.query.q));
      const match = or(like(studyGroups.name, term), like(studyGroups.description, term));
      if (match) filters.push(match);
    }
    if (req.query.mine) {
      const mine = db.select({ id: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, viewerId));
      filters.push(inArray(studyGroups.id, mine));
    }

    const where = filters.length ? and(...filters)! : undefined;
    const base = db
      .select({ group: studyGroups, owner: authorColumns })
      .from(studyGroups)
      .innerJoin(users, eq(studyGroups.ownerId, users.id));

    const [rows, total] = await Promise.all([
      (where ? base.where(where) : base)
        .orderBy(desc(studyGroups.memberCount), desc(studyGroups.id))
        .limit(page.limit)
        .offset(page.skip),
      countRows(studyGroups, where),
    ]);

    const joined = await joinedIds(
      viewerId,
      rows.map((r) => r.group.id),
    );
    res.json(
      paginated(
        rows.map((r) => mapGroup(r, joined, viewerId)),
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
    const viewerId = req.user!.id;

    const [row] = await db
      .select({ group: studyGroups, owner: authorColumns })
      .from(studyGroups)
      .innerJoin(users, eq(studyGroups.ownerId, users.id))
      .where(eq(studyGroups.id, id))
      .limit(1);
    if (!row) throw ApiError.notFound('That group no longer exists.');

    const members = await db
      .select({ member: authorColumns, role: groupMembers.role })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(eq(groupMembers.groupId, id))
      .orderBy(asc(groupMembers.createdAt))
      .limit(24);

    const joined = await joinedIds(viewerId, [id]);
    res.json({
      group: mapGroup(row, joined, viewerId),
      members: members.map((m) => ({ ...toUserSummary(m.member), groupRole: m.role })),
    });
  }),
);

router.post(
  '/',
  writeLimiter,
  validate({ body: groupBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const viewerId = req.user!.id;

    const [existing] = await db
      .select({ id: studyGroups.id })
      .from(studyGroups)
      .where(eq(studyGroups.name, req.body.name))
      .limit(1);
    if (existing) throw ApiError.conflict('A group with that name already exists.');

    // The creator is a member from the moment the group exists, so the count and
    // the membership row are written together.
    const id = await db.transaction(async (tx) => {
      const [result] = await tx.insert(studyGroups).values({
        ownerId: viewerId,
        name: req.body.name,
        description: req.body.description ?? '',
        category: req.body.category,
        memberCount: 1,
      });
      const groupId = Number(result.insertId);
      await tx.insert(groupMembers).values({ groupId, userId: viewerId, role: 'owner' });
      return groupId;
    });

    const [row] = await db
      .select({ group: studyGroups, owner: authorColumns })
      .from(studyGroups)
      .innerJoin(users, eq(studyGroups.ownerId, users.id))
      .where(eq(studyGroups.id, id))
      .limit(1);
    res.status(201).json({ group: mapGroup(row!, new Set([id]), viewerId) });
  }),
);

/** Joining and leaving are the same button, so they are the same endpoint. */
router.post(
  '/:id/membership',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const groupId = Number(req.params.id);
    const viewerId = req.user!.id;

    const result = await db.transaction(async (tx) => {
      const [group] = await tx.select().from(studyGroups).where(eq(studyGroups.id, groupId)).limit(1);
      if (!group) throw ApiError.notFound('That group no longer exists.');

      const where = and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, viewerId))!;
      const [existing] = await tx.select({ role: groupMembers.role }).from(groupMembers).where(where).limit(1);

      if (existing) {
        // The owner cannot walk out and leave the group without one.
        if (existing.role === 'owner') {
          throw ApiError.badRequest('You own this group. Delete it instead of leaving.');
        }
        await tx.delete(groupMembers).where(where);
        await tx
          .update(studyGroups)
          .set({ memberCount: sql`greatest(${studyGroups.memberCount} - 1, 0)` })
          .where(eq(studyGroups.id, groupId));
        return { isMember: false };
      }

      await tx.insert(groupMembers).values({ groupId, userId: viewerId });
      await tx
        .update(studyGroups)
        .set({ memberCount: sql`${studyGroups.memberCount} + 1` })
        .where(eq(studyGroups.id, groupId));
      return { isMember: true };
    });

    const [group] = await db
      .select({ memberCount: studyGroups.memberCount })
      .from(studyGroups)
      .where(eq(studyGroups.id, groupId))
      .limit(1);
    res.json({ ...result, memberCount: group?.memberCount ?? 0 });
  }),
);

router.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [group] = await db
      .select({ ownerId: studyGroups.ownerId })
      .from(studyGroups)
      .where(eq(studyGroups.id, id))
      .limit(1);
    if (!group) throw ApiError.notFound('That group no longer exists.');
    if (group.ownerId !== req.user!.id && req.user!.role !== 'admin') {
      throw ApiError.forbidden('Only the group owner can delete it.');
    }
    // Members, discussions and replies all cascade.
    await db.delete(studyGroups).where(eq(studyGroups.id, id));
    res.status(204).end();
  }),
);

/* ---------------------------- Discussions ---------------------------- */

/** Reading a group's discussion requires membership — that is the point of a group. */
async function assertMember(groupId: number, userId: number) {
  const [row] = await db
    .select({ one: sql<number>`1` })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))!)
    .limit(1);
  if (!row) throw ApiError.forbidden('Join this group to take part in its discussion.');
}

router.get(
  '/:id/discussions',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const groupId = Number(req.params.id);
    const viewerId = req.user!.id;
    await assertMember(groupId, viewerId);

    const page = getPageParams(req, 10, 40);
    const where = eq(groupDiscussions.groupId, groupId);

    const [rows, total] = await Promise.all([
      db
        .select({ discussion: groupDiscussions, author: authorColumns })
        .from(groupDiscussions)
        .innerJoin(users, eq(groupDiscussions.authorId, users.id))
        .where(where)
        .orderBy(desc(groupDiscussions.createdAt), desc(groupDiscussions.id))
        .limit(page.limit)
        .offset(page.skip),
      countRows(groupDiscussions, where),
    ]);

    // Replies for the whole page in one query rather than one per discussion.
    const ids = rows.map((r) => r.discussion.id);
    const replies = ids.length
      ? await db
          .select({ reply: groupReplies, author: authorColumns })
          .from(groupReplies)
          .innerJoin(users, eq(groupReplies.authorId, users.id))
          .where(inArray(groupReplies.discussionId, ids))
          .orderBy(asc(groupReplies.createdAt), asc(groupReplies.id))
      : [];

    const grouped = new Map<number, unknown[]>();
    for (const r of replies) {
      const list = grouped.get(r.reply.discussionId) ?? [];
      list.push({
        id: r.reply.id,
        body: r.reply.body,
        author: toUserSummary(r.author),
        isMine: r.reply.authorId === viewerId,
        createdAt: r.reply.createdAt,
      });
      grouped.set(r.reply.discussionId, list);
    }

    const items = rows.map((r) => ({
      id: r.discussion.id,
      body: r.discussion.body,
      replyCount: r.discussion.replyCount,
      author: toUserSummary(r.author),
      isMine: r.discussion.authorId === viewerId,
      createdAt: r.discussion.createdAt,
      replies: grouped.get(r.discussion.id) ?? [],
    }));
    res.json(paginated(items, total, page));
  }),
);

router.post(
  '/:id/discussions',
  validate({ params: idParam, body: z.object({ body: z.string().trim().min(1, 'Write something').max(2000) }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const groupId = Number(req.params.id);
    await assertMember(groupId, req.user!.id);

    const [result] = await db.insert(groupDiscussions).values({
      groupId,
      authorId: req.user!.id,
      body: req.body.body,
    });

    const [row] = await db
      .select({ discussion: groupDiscussions, author: authorColumns })
      .from(groupDiscussions)
      .innerJoin(users, eq(groupDiscussions.authorId, users.id))
      .where(eq(groupDiscussions.id, Number(result.insertId)))
      .limit(1);

    res.status(201).json({
      discussion: {
        id: row!.discussion.id,
        body: row!.discussion.body,
        replyCount: 0,
        author: toUserSummary(row!.author),
        isMine: true,
        createdAt: row!.discussion.createdAt,
        replies: [],
      },
    });
  }),
);

router.post(
  '/:id/discussions/:discussionId/replies',
  validate({ params: discussionParams, body: z.object({ body: z.string().trim().min(1, 'Write a reply').max(1000) }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const groupId = Number(req.params.id);
    const discussionId = Number(req.params.discussionId);
    await assertMember(groupId, req.user!.id);

    const [discussion] = await db
      .select({ id: groupDiscussions.id })
      .from(groupDiscussions)
      .where(and(eq(groupDiscussions.id, discussionId), eq(groupDiscussions.groupId, groupId))!)
      .limit(1);
    if (!discussion) throw ApiError.notFound('That discussion no longer exists.');

    // The reply and the count it feeds move together.
    const replyId = await db.transaction(async (tx) => {
      const [result] = await tx
        .insert(groupReplies)
        .values({ discussionId, authorId: req.user!.id, body: req.body.body });
      await tx
        .update(groupDiscussions)
        .set({ replyCount: sql`${groupDiscussions.replyCount} + 1` })
        .where(eq(groupDiscussions.id, discussionId));
      return Number(result.insertId);
    });

    const [row] = await db
      .select({ reply: groupReplies, author: authorColumns })
      .from(groupReplies)
      .innerJoin(users, eq(groupReplies.authorId, users.id))
      .where(eq(groupReplies.id, replyId))
      .limit(1);

    res.status(201).json({
      reply: {
        id: row!.reply.id,
        body: row!.reply.body,
        author: toUserSummary(row!.author),
        isMine: true,
        createdAt: row!.reply.createdAt,
      },
    });
  }),
);

router.delete(
  '/:id/discussions/:discussionId',
  validate({ params: discussionParams }),
  asyncHandler(async (req: Request, res: Response) => {
    const discussionId = Number(req.params.discussionId);
    const [discussion] = await db
      .select({ authorId: groupDiscussions.authorId, groupId: groupDiscussions.groupId })
      .from(groupDiscussions)
      .where(eq(groupDiscussions.id, discussionId))
      .limit(1);
    if (!discussion) throw ApiError.notFound('That discussion no longer exists.');

    const [group] = await db
      .select({ ownerId: studyGroups.ownerId })
      .from(studyGroups)
      .where(eq(studyGroups.id, discussion.groupId))
      .limit(1);

    // Your own message, or anything in a group you own.
    const isAuthor = discussion.authorId === req.user!.id;
    const isOwner = group?.ownerId === req.user!.id;
    if (!isAuthor && !isOwner && req.user!.role !== 'admin') {
      throw ApiError.forbidden('You can only remove your own messages.');
    }

    await db.delete(groupDiscussions).where(eq(groupDiscussions.id, discussionId));
    res.status(204).end();
  }),
);

export default router;
