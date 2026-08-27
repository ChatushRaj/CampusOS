import type { Request, Response } from 'express';
import { and, asc, desc, eq, inArray, like, ne, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { blogs, connections, posts, userInterests, users } from '../../db/schema.js';
import { countRows } from '../../db/helpers.js';
import { ApiError } from '../../utils/ApiError.js';
import { containsPattern, getPageParams, paginated } from '../../utils/pagination.js';
import { relativePath, removeFile } from '../../middleware/upload.js';
import { toPublicUser, toUserSummary } from './user.mapper.js';

const summaryColumns = {
  id: users.id,
  name: users.name,
  role: users.role,
  headline: users.headline,
  department: users.department,
  graduationYear: users.graduationYear,
  avatarPath: users.avatarPath,
};

async function interestsFor(userId: number): Promise<string[]> {
  const rows = await db
    .select({ interest: userInterests.interest })
    .from(userInterests)
    .where(eq(userInterests.userId, userId));
  return rows.map((r) => r.interest);
}

/** Directory of campus members, with search and filters. */
export async function listUsers(req: Request, res: Response) {
  const page = getPageParams(req, 12, 50);
  const viewerId = req.user!.id;

  const filters = [eq(users.isActive, true), ne(users.id, viewerId)];
  if (req.query.q) {
    const term = containsPattern(String(req.query.q));
    const match = or(like(users.name, term), like(users.headline, term), like(users.department, term));
    if (match) filters.push(match);
  }
  if (req.query.department) filters.push(eq(users.department, String(req.query.department)));
  if (req.query.graduationYear) filters.push(eq(users.graduationYear, Number(req.query.graduationYear)));
  if (req.query.role) filters.push(eq(users.role, String(req.query.role) as 'student'));

  const where = and(...filters)!;
  const [rows, total] = await Promise.all([
    db.select(summaryColumns).from(users).where(where).orderBy(asc(users.name)).limit(page.limit).offset(page.skip),
    countRows(users, where),
  ]);

  // Resolve the viewer's relationship to every row in one query rather than N.
  const ids = rows.map((r) => r.id);
  const links = ids.length
    ? await db
        .select()
        .from(connections)
        .where(
          or(
            and(eq(connections.requesterId, viewerId), inArray(connections.recipientId, ids)),
            and(eq(connections.recipientId, viewerId), inArray(connections.requesterId, ids)),
          )!,
        )
    : [];

  const linkFor = new Map<number, { id: number; status: string; direction: 'outgoing' | 'incoming' }>();
  for (const link of links) {
    const isOutgoing = link.requesterId === viewerId;
    linkFor.set(isOutgoing ? link.recipientId : link.requesterId, {
      id: link.id,
      status: link.status,
      direction: isOutgoing ? 'outgoing' : 'incoming',
    });
  }

  const items = rows.map((row) => ({ ...toUserSummary(row)!, connection: linkFor.get(row.id) ?? null }));
  res.json(paginated(items, total, page));
}

export async function getUser(req: Request, res: Response) {
  const viewerId = req.user!.id;
  const targetId = Number(req.params.id);

  const [user] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
  if (!user || !user.isActive) throw ApiError.notFound('We could not find that profile.');

  const [postCount, blogCount, connectionCount, interests, link] = await Promise.all([
    countRows(posts, eq(posts.authorId, targetId)),
    countRows(blogs, and(eq(blogs.authorId, targetId), eq(blogs.published, true))!),
    countRows(
      connections,
      and(
        eq(connections.status, 'accepted'),
        or(eq(connections.requesterId, targetId), eq(connections.recipientId, targetId)),
      )!,
    ),
    interestsFor(targetId),
    db
      .select()
      .from(connections)
      .where(
        or(
          and(eq(connections.requesterId, viewerId), eq(connections.recipientId, targetId)),
          and(eq(connections.recipientId, viewerId), eq(connections.requesterId, targetId)),
        )!,
      )
      .limit(1),
  ]);

  const relationship = link[0];
  res.json({
    user: toPublicUser(user, interests),
    stats: { posts: postCount, blogs: blogCount, connections: connectionCount },
    connection: relationship
      ? {
          id: relationship.id,
          status: relationship.status,
          direction: relationship.requesterId === viewerId ? 'outgoing' : 'incoming',
        }
      : null,
    isSelf: targetId === viewerId,
  });
}

export async function updateProfile(req: Request, res: Response) {
  const userId = req.user!.id;
  const { interests, ...profile } = req.body as Record<string, unknown> & { interests?: string[] };

  await db.transaction(async (tx) => {
    if (Object.keys(profile).length > 0) {
      await tx.update(users).set(profile).where(eq(users.id, userId));
    }
    if (Array.isArray(interests)) {
      // Replace the whole set: simpler and cheaper than diffing at this size.
      await tx.delete(userInterests).where(eq(userInterests.userId, userId));
      const unique = [...new Set(interests.map((i) => i.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
      if (unique.length) {
        await tx.insert(userInterests).values(unique.map((interest) => ({ userId, interest })));
      }
    }
  });

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw ApiError.notFound('That account no longer exists.');
  res.json({ user: toPublicUser(user, await interestsFor(userId)) });
}

export async function updateAvatar(req: Request, res: Response) {
  if (!req.file) throw ApiError.badRequest('Choose an image to upload.');
  const userId = req.user!.id;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw ApiError.notFound('That account no longer exists.');

  const previous = user.avatarPath;
  const avatarPath = relativePath(req.file);
  await db.update(users).set({ avatarPath }).where(eq(users.id, userId));
  removeFile(previous); // Replace, do not accumulate.

  res.json({ user: toPublicUser({ ...user, avatarPath }, await interestsFor(userId)) });
}

/** Suggests people in the same department or year who are not connected yet. */
export async function suggestions(req: Request, res: Response) {
  const viewerId = req.user!.id;
  const [me] = await db.select().from(users).where(eq(users.id, viewerId)).limit(1);
  if (!me) throw ApiError.notFound('That account no longer exists.');

  const links = await db
    .select({ requesterId: connections.requesterId, recipientId: connections.recipientId })
    .from(connections)
    .where(or(eq(connections.requesterId, viewerId), eq(connections.recipientId, viewerId))!);

  const excluded = new Set<number>([viewerId]);
  for (const link of links) {
    excluded.add(link.requesterId);
    excluded.add(link.recipientId);
  }

  const filters = [eq(users.isActive, true), sql`${users.id} not in (${sql.join([...excluded], sql`, `)})`];
  if (me.department || me.graduationYear) {
    const affinity = or(
      me.department ? eq(users.department, me.department) : undefined,
      me.graduationYear ? eq(users.graduationYear, me.graduationYear) : undefined,
    );
    if (affinity) filters.push(affinity);
  }

  const rows = await db
    .select(summaryColumns)
    .from(users)
    .where(and(...filters)!)
    .orderBy(desc(users.lastSeenAt))
    .limit(6);

  res.json({ items: rows.map((r) => toUserSummary(r)) });
}
