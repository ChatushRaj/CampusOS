import { Router, type Request, type Response } from 'express';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { pollOptions, pollVotes, polls, users } from '../../db/schema.js';
import { countRows } from '../../db/helpers.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getPageParams, paginated } from '../../utils/pagination.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rateLimit.js';
import { toUserSummary } from '../users/user.mapper.js';

const idParam = z.object({ id: z.coerce.number().int().positive('That identifier is not valid') });

const pollBody = z.object({
  question: z.string().trim().min(4, 'Ask a question').max(200),
  options: z
    .array(z.string().trim().min(1, 'Options cannot be blank').max(80))
    .min(2, 'Add at least two options')
    .max(6, 'Up to six options'),
  closesAt: z.coerce.date().nullish(),
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

function mapPoll(row: any, options: any[], myVote: number | null, viewerRole: string, viewerId: number) {
  const p = row.poll;
  const total = p.totalVotes ?? 0;
  return {
    id: p.id,
    question: p.question,
    // Percentages are computed here so every client rounds identically.
    options: options.map((o) => ({
      id: o.id,
      label: o.label,
      voteCount: o.voteCount,
      percentage: total > 0 ? Math.round((o.voteCount / total) * 100) : 0,
    })),
    totalVotes: total,
    closesAt: p.closesAt,
    isClosed: p.closesAt ? new Date(p.closesAt).getTime() < Date.now() : false,
    myVote,
    author: toUserSummary(row.author),
    canManage: viewerRole === 'admin' || p.authorId === viewerId,
    createdAt: p.createdAt,
  };
}

async function loadOptions(pollIds: number[]) {
  if (pollIds.length === 0) return new Map<number, any[]>();
  const rows = await db
    .select()
    .from(pollOptions)
    .where(sql`${pollOptions.pollId} in (${sql.join(pollIds, sql`, `)})`)
    .orderBy(asc(pollOptions.position));
  const grouped = new Map<number, any[]>();
  for (const row of rows) {
    const list = grouped.get(row.pollId) ?? [];
    list.push(row);
    grouped.set(row.pollId, list);
  }
  return grouped;
}

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const page = getPageParams(req, 8, 30);
    const [rows, total] = await Promise.all([
      db
        .select({ poll: polls, author: authorColumns })
        .from(polls)
        .innerJoin(users, eq(polls.authorId, users.id))
        .orderBy(desc(polls.createdAt), desc(polls.id))
        .limit(page.limit)
        .offset(page.skip),
      countRows(polls),
    ]);

    const ids = rows.map((r) => r.poll.id);
    const [optionMap, votes] = await Promise.all([
      loadOptions(ids),
      ids.length
        ? db
            .select({ pollId: pollVotes.pollId, optionId: pollVotes.optionId })
            .from(pollVotes)
            .where(and(eq(pollVotes.userId, req.user!.id), sql`${pollVotes.pollId} in (${sql.join(ids, sql`, `)})`)!)
        : [],
    ]);
    const mine = new Map(votes.map((v) => [v.pollId, v.optionId]));

    res.json(
      paginated(
        rows.map((r) =>
          mapPoll(r, optionMap.get(r.poll.id) ?? [], mine.get(r.poll.id) ?? null, req.user!.role, req.user!.id),
        ),
        total,
        page,
      ),
    );
  }),
);

router.post(
  '/',
  writeLimiter,
  validate({ body: pollBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = await db.transaction(async (tx) => {
      const [result] = await tx.insert(polls).values({
        authorId: req.user!.id,
        question: req.body.question,
        closesAt: req.body.closesAt ?? null,
      });
      const pollId = Number(result.insertId);
      await tx
        .insert(pollOptions)
        .values((req.body.options as string[]).map((label, position) => ({ pollId, label, position })));
      return pollId;
    });

    const [row] = await db
      .select({ poll: polls, author: authorColumns })
      .from(polls)
      .innerJoin(users, eq(polls.authorId, users.id))
      .where(eq(polls.id, id))
      .limit(1);
    const optionMap = await loadOptions([id]);
    res.status(201).json({ poll: mapPoll(row!, optionMap.get(id) ?? [], null, req.user!.role, req.user!.id) });
  }),
);

router.post(
  '/:id/vote',
  validate({ params: idParam, body: z.object({ optionId: z.coerce.number().int().positive('Choose an option') }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const pollId = Number(req.params.id);
    const optionId = Number(req.body.optionId);
    const userId = req.user!.id;

    await db.transaction(async (tx) => {
      const [poll] = await tx.select().from(polls).where(eq(polls.id, pollId)).limit(1);
      if (!poll) throw ApiError.notFound('That poll no longer exists.');
      if (poll.closesAt && new Date(poll.closesAt).getTime() < Date.now()) {
        throw ApiError.badRequest('This poll has closed.');
      }

      const [option] = await tx
        .select()
        .from(pollOptions)
        .where(and(eq(pollOptions.id, optionId), eq(pollOptions.pollId, pollId))!)
        .limit(1);
      if (!option) throw ApiError.badRequest('That option is not part of this poll.');

      const [existing] = await tx
        .select({ optionId: pollVotes.optionId })
        .from(pollVotes)
        .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId))!)
        .limit(1);

      if (existing?.optionId === optionId) throw ApiError.badRequest('You have already chosen that option.');

      if (existing) {
        // Move the vote: the old option loses one, the new one gains one.
        await tx
          .update(pollOptions)
          .set({ voteCount: sql`greatest(${pollOptions.voteCount} - 1, 0)` })
          .where(eq(pollOptions.id, existing.optionId));
        await tx
          .update(pollVotes)
          .set({ optionId })
          .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId))!);
      } else {
        await tx.insert(pollVotes).values({ pollId, userId, optionId });
        await tx
          .update(polls)
          .set({ totalVotes: sql`${polls.totalVotes} + 1` })
          .where(eq(polls.id, pollId));
      }

      await tx
        .update(pollOptions)
        .set({ voteCount: sql`${pollOptions.voteCount} + 1` })
        .where(eq(pollOptions.id, optionId));
    });

    const [row] = await db
      .select({ poll: polls, author: authorColumns })
      .from(polls)
      .innerJoin(users, eq(polls.authorId, users.id))
      .where(eq(polls.id, pollId))
      .limit(1);
    const optionMap = await loadOptions([pollId]);
    res.json({ poll: mapPoll(row!, optionMap.get(pollId) ?? [], optionId, req.user!.role, req.user!.id) });
  }),
);

router.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [existing] = await db.select({ authorId: polls.authorId }).from(polls).where(eq(polls.id, id)).limit(1);
    if (!existing) throw ApiError.notFound('That poll no longer exists.');
    if (existing.authorId !== req.user!.id && req.user!.role !== 'admin') {
      throw ApiError.forbidden('You can only delete your own polls.');
    }
    await db.delete(polls).where(eq(polls.id, id)); // Options and votes cascade.
    res.status(204).end();
  }),
);

export default router;
