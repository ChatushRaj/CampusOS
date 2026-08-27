import type { Request, Response } from 'express';
import { and, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { connections, postComments, postImages, postTags, posts, tags, users } from '../../db/schema.js';
import { countRows, setTags, tagsForOwners } from '../../db/helpers.js';
import { ApiError } from '../../utils/ApiError.js';
import { containsPattern, getPageParams, paginated } from '../../utils/pagination.js';
import { mediaUrls } from '../../utils/media.js';
import { relativePaths, removeFile } from '../../middleware/upload.js';
import { toUserSummary } from '../users/user.mapper.js';
import { bookmarkedIds, likedIds, toggleBookmark, toggleLike } from '../../services/engagement.service.js';
import { notify } from '../../services/notification.service.js';

const authorColumns = {
  id: users.id,
  name: users.name,
  role: users.role,
  headline: users.headline,
  department: users.department,
  graduationYear: users.graduationYear,
  avatarPath: users.avatarPath,
};

const postColumns = {
  id: posts.id,
  authorId: posts.authorId,
  body: posts.body,
  visibility: posts.visibility,
  likeCount: posts.likeCount,
  commentCount: posts.commentCount,
  createdAt: posts.createdAt,
  updatedAt: posts.updatedAt,
};

/** Ids of everyone the viewer is connected to, used for connections-only visibility. */
async function circleOf(viewerId: number): Promise<number[]> {
  const rows = await db
    .select({ requesterId: connections.requesterId, recipientId: connections.recipientId })
    .from(connections)
    .where(
      and(
        eq(connections.status, 'accepted'),
        or(eq(connections.requesterId, viewerId), eq(connections.recipientId, viewerId)),
      )!,
    );
  return rows.map((r) => (r.requesterId === viewerId ? r.recipientId : r.requesterId));
}

async function imagesForPosts(ids: number[]): Promise<Map<number, string[]>> {
  const grouped = new Map<number, string[]>();
  if (ids.length === 0) return grouped;
  const rows = await db
    .select({ postId: postImages.postId, path: postImages.path })
    .from(postImages)
    .where(inArray(postImages.postId, ids))
    .orderBy(postImages.position);
  for (const row of rows) {
    const list = grouped.get(row.postId) ?? [];
    list.push(row.path);
    grouped.set(row.postId, list);
  }
  return grouped;
}

function mapPost(
  row: { post: any; author: any },
  images: Map<number, string[]>,
  tagMap: Map<number, string[]>,
  liked: Set<number>,
  saved: Set<number>,
  viewerId: number,
) {
  const id = row.post.id as number;
  return {
    id,
    body: row.post.body,
    images: mediaUrls(images.get(id) ?? []),
    tags: tagMap.get(id) ?? [],
    visibility: row.post.visibility,
    likeCount: row.post.likeCount ?? 0,
    commentCount: row.post.commentCount ?? 0,
    author: toUserSummary(row.author),
    isLiked: liked.has(id),
    isBookmarked: saved.has(id),
    isMine: row.post.authorId === viewerId,
    createdAt: row.post.createdAt,
    updatedAt: row.post.updatedAt,
  };
}

async function decorate(rows: { post: any; author: any }[], viewerId: number) {
  const ids = rows.map((r) => r.post.id as number);
  const [images, tagMap, liked, saved] = await Promise.all([
    imagesForPosts(ids),
    tagsForOwners('post', ids),
    likedIds('post', viewerId, ids),
    bookmarkedIds('post', viewerId, ids),
  ]);
  return rows.map((row) => mapPost(row, images, tagMap, liked, saved, viewerId));
}

export async function listPosts(req: Request, res: Response) {
  const page = getPageParams(req);
  const viewerId = req.user!.id;
  const filters = [];

  if (req.query.author) filters.push(eq(posts.authorId, Number(req.query.author)));
  if (req.query.q) filters.push(like(posts.body, containsPattern(String(req.query.q))));

  if (req.query.tag) {
    // Restrict to posts carrying the tag, resolved through the junction table.
    const tagged = db
      .select({ id: postTags.postId })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(tags.name, String(req.query.tag).toLowerCase()));
    filters.push(inArray(posts.id, tagged));
  }

  const circle = await circleOf(viewerId);
  const visible = [...circle, viewerId];

  if (req.query.scope === 'connections') {
    filters.push(inArray(posts.authorId, visible));
  } else {
    // A connections-only post must not surface campus-wide to an outsider.
    const scope = or(eq(posts.visibility, 'campus'), inArray(posts.authorId, visible));
    if (scope) filters.push(scope);
  }

  const where = filters.length ? and(...filters)! : undefined;
  const base = db
    .select({ post: postColumns, author: authorColumns })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id));

  const [rows, total] = await Promise.all([
    (where ? base.where(where) : base)
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(page.limit)
      .offset(page.skip),
    countRows(posts, where),
  ]);

  res.json(paginated(await decorate(rows, viewerId), total, page));
}

export async function getPost(req: Request, res: Response) {
  const viewerId = req.user!.id;
  const [row] = await db
    .select({ post: postColumns, author: authorColumns })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, Number(req.params.id)))
    .limit(1);
  if (!row) throw ApiError.notFound('That post no longer exists.');

  const [mapped] = await decorate([row], viewerId);
  res.json({ post: mapped });
}

export async function createPost(req: Request, res: Response) {
  const files = (req.files as Express.Multer.File[]) ?? [];
  const viewerId = req.user!.id;
  const paths = relativePaths(files);

  const postId = await db.transaction(async (tx) => {
    const [result] = await tx.insert(posts).values({
      authorId: viewerId,
      body: req.body.body,
      visibility: req.body.visibility,
    });
    const id = Number(result.insertId);
    if (paths.length) {
      await tx.insert(postImages).values(paths.map((path, position) => ({ postId: id, path, position })));
    }
    return id;
  });

  await setTags('post', postId, req.body.tags ?? []);

  const [row] = await db
    .select({ post: postColumns, author: authorColumns })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, postId))
    .limit(1);
  const [mapped] = await decorate([row!], viewerId);
  res.status(201).json({ post: mapped });
}

export async function updatePost(req: Request, res: Response) {
  const id = Number(req.params.id);
  const [existing] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, id)).limit(1);
  if (!existing) throw ApiError.notFound('That post no longer exists.');
  if (existing.authorId !== req.user!.id) throw ApiError.forbidden('You can only edit your own posts.');

  await db.update(posts).set({ body: req.body.body }).where(eq(posts.id, id));

  const [row] = await db
    .select({ post: postColumns, author: authorColumns })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, id))
    .limit(1);
  const [mapped] = await decorate([row!], req.user!.id);
  res.json({ post: mapped });
}

export async function deletePost(req: Request, res: Response) {
  const id = Number(req.params.id);
  const [existing] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, id)).limit(1);
  if (!existing) throw ApiError.notFound('That post no longer exists.');
  // Authors delete their own work; moderators delete anything.
  if (existing.authorId !== req.user!.id && req.user!.role !== 'admin') {
    throw ApiError.forbidden('You can only delete your own posts.');
  }

  const images = await db.select({ path: postImages.path }).from(postImages).where(eq(postImages.postId, id));
  // Child rows (images, tags, likes, bookmarks, comments) go with it via ON DELETE CASCADE.
  await db.delete(posts).where(eq(posts.id, id));
  for (const image of images) removeFile(image.path);

  res.status(204).end();
}

export async function likePost(req: Request, res: Response) {
  const id = Number(req.params.id);
  const [post] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, id)).limit(1);
  if (!post) throw ApiError.notFound('That post no longer exists.');

  const { liked, likeCount } = await toggleLike('post', req.user!.id, id);

  if (liked) {
    await notify({
      recipientId: post.authorId,
      actorId: req.user!.id,
      type: 'post_like',
      message: 'liked your post',
      link: `/app/posts/${id}`,
    });
  }
  res.json({ isLiked: liked, likeCount });
}

export async function bookmarkPost(req: Request, res: Response) {
  const id = Number(req.params.id);
  const [exists] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, id)).limit(1);
  if (!exists) throw ApiError.notFound('That post no longer exists.');
  const { bookmarked } = await toggleBookmark('post', req.user!.id, id);
  res.json({ isBookmarked: bookmarked });
}

export async function listComments(req: Request, res: Response) {
  const page = getPageParams(req, 20, 50);
  const postId = Number(req.params.id);
  const where = eq(postComments.postId, postId);

  const [rows, total] = await Promise.all([
    db
      .select({
        id: postComments.id,
        body: postComments.body,
        createdAt: postComments.createdAt,
        authorId: postComments.authorId,
        author: authorColumns,
      })
      .from(postComments)
      .innerJoin(users, eq(postComments.authorId, users.id))
      .where(where)
      .orderBy(desc(postComments.createdAt), desc(postComments.id))
      .limit(page.limit)
      .offset(page.skip),
    countRows(postComments, where),
  ]);

  const items = rows.map((r) => ({
    id: r.id,
    body: r.body,
    author: toUserSummary(r.author),
    isMine: r.authorId === req.user!.id,
    createdAt: r.createdAt,
  }));
  res.json(paginated(items, total, page));
}

export async function addComment(req: Request, res: Response) {
  const postId = Number(req.params.id);
  const [post] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) throw ApiError.notFound('That post no longer exists.');

  // The comment and the counter move together or not at all.
  const commentId = await db.transaction(async (tx) => {
    const [result] = await tx.insert(postComments).values({ postId, authorId: req.user!.id, body: req.body.body });
    await tx
      .update(posts)
      .set({ commentCount: sql`${posts.commentCount} + 1` })
      .where(eq(posts.id, postId));
    return Number(result.insertId);
  });

  await notify({
    recipientId: post.authorId,
    actorId: req.user!.id,
    type: 'post_comment',
    message: 'commented on your post',
    link: `/app/posts/${postId}`,
  });

  const [row] = await db
    .select({ id: postComments.id, body: postComments.body, createdAt: postComments.createdAt, author: authorColumns })
    .from(postComments)
    .innerJoin(users, eq(postComments.authorId, users.id))
    .where(eq(postComments.id, commentId))
    .limit(1);

  res.status(201).json({
    comment: {
      id: row!.id,
      body: row!.body,
      author: toUserSummary(row!.author),
      isMine: true,
      createdAt: row!.createdAt,
    },
  });
}

export async function deleteComment(req: Request, res: Response) {
  const commentId = Number(req.params.commentId);
  const [comment] = await db
    .select({ id: postComments.id, authorId: postComments.authorId, postId: postComments.postId })
    .from(postComments)
    .where(eq(postComments.id, commentId))
    .limit(1);
  if (!comment) throw ApiError.notFound('That comment no longer exists.');
  if (comment.authorId !== req.user!.id && req.user!.role !== 'admin') {
    throw ApiError.forbidden('You can only delete your own comments.');
  }

  await db.transaction(async (tx) => {
    await tx.delete(postComments).where(eq(postComments.id, commentId));
    await tx
      .update(posts)
      .set({ commentCount: sql`greatest(${posts.commentCount} - 1, 0)` })
      .where(eq(posts.id, comment.postId));
  });

  res.status(204).end();
}
