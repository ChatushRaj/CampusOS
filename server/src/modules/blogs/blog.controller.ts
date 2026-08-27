import type { Request, Response } from 'express';
import { and, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { blogComments, blogTags, blogs, tags, users } from '../../db/schema.js';
import { countRows, setTags, tagsForOwners } from '../../db/helpers.js';
import { ApiError } from '../../utils/ApiError.js';
import { containsPattern, getPageParams, paginated } from '../../utils/pagination.js';
import { mediaUrl } from '../../utils/media.js';
import { relativePath, removeFile } from '../../middleware/upload.js';
import { toUserSummary } from '../users/user.mapper.js';
import { bookmarkedIds, likedIds, toggleBookmark, toggleLike } from '../../services/engagement.service.js';
import { notify } from '../../services/notification.service.js';
import { estimateReadMinutes, slugify } from './blog.schema.js';

const authorColumns = {
  id: users.id,
  name: users.name,
  role: users.role,
  headline: users.headline,
  department: users.department,
  graduationYear: users.graduationYear,
  avatarPath: users.avatarPath,
};

function mapBlog(
  row: any,
  tagMap: Map<number, string[]>,
  liked: Set<number>,
  saved: Set<number>,
  viewerId: number,
  withBody = false,
) {
  const b = row.blog;
  return {
    id: b.id,
    title: b.title,
    slug: b.slug,
    excerpt: b.excerpt,
    ...(withBody ? { body: b.body } : {}),
    coverUrl: mediaUrl(b.coverPath),
    tags: tagMap.get(b.id) ?? [],
    readMinutes: b.readMinutes,
    likeCount: b.likeCount,
    commentCount: b.commentCount,
    viewCount: b.viewCount,
    author: toUserSummary(row.author),
    isLiked: liked.has(b.id),
    isBookmarked: saved.has(b.id),
    isMine: b.authorId === viewerId,
    createdAt: b.createdAt,
  };
}

async function decorate(rows: any[], viewerId: number, withBody = false) {
  const ids = rows.map((r) => r.blog.id as number);
  const [tagMap, liked, saved] = await Promise.all([
    tagsForOwners('blog', ids),
    likedIds('blog', viewerId, ids),
    bookmarkedIds('blog', viewerId, ids),
  ]);
  return rows.map((row) => mapBlog(row, tagMap, liked, saved, viewerId, withBody));
}

/** Appends a counter when the base slug is taken, so the unique index never trips. */
async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || 'article';
  const taken = await db
    .select({ slug: blogs.slug })
    .from(blogs)
    .where(like(blogs.slug, `${base}%`));
  const set = new Set(taken.map((t) => t.slug));
  if (!set.has(base)) return base;
  let n = 2;
  while (set.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export async function listBlogs(req: Request, res: Response) {
  const page = getPageParams(req, 9, 30);
  const viewerId = req.user!.id;
  const filters = [eq(blogs.published, true)];

  if (req.query.author) filters.push(eq(blogs.authorId, Number(req.query.author)));
  if (req.query.q) {
    const term = containsPattern(String(req.query.q));
    const match = or(like(blogs.title, term), like(blogs.excerpt, term));
    if (match) filters.push(match);
  }
  if (req.query.tag) {
    const tagged = db
      .select({ id: blogTags.blogId })
      .from(blogTags)
      .innerJoin(tags, eq(blogTags.tagId, tags.id))
      .where(eq(tags.name, String(req.query.tag).toLowerCase()));
    filters.push(inArray(blogs.id, tagged));
  }

  const where = and(...filters)!;
  // The id breaks ties so pagination stays stable when rows share a timestamp.
  const order =
    req.query.sort === 'popular'
      ? [desc(blogs.likeCount), desc(blogs.createdAt), desc(blogs.id)]
      : [desc(blogs.createdAt), desc(blogs.id)];

  const [rows, total] = await Promise.all([
    db
      .select({ blog: blogs, author: authorColumns })
      .from(blogs)
      .innerJoin(users, eq(blogs.authorId, users.id))
      .where(where)
      .orderBy(...order)
      .limit(page.limit)
      .offset(page.skip),
    countRows(blogs, where),
  ]);

  res.json(paginated(await decorate(rows, viewerId), total, page));
}

export async function getBlog(req: Request, res: Response) {
  const id = Number(req.params.id);
  const viewerId = req.user!.id;

  await db
    .update(blogs)
    .set({ viewCount: sql`${blogs.viewCount} + 1` })
    .where(eq(blogs.id, id));

  const [row] = await db
    .select({ blog: blogs, author: authorColumns })
    .from(blogs)
    .innerJoin(users, eq(blogs.authorId, users.id))
    .where(eq(blogs.id, id))
    .limit(1);
  if (!row) throw ApiError.notFound('That article no longer exists.');

  const [mapped] = await decorate([row], viewerId, true);
  res.json({ blog: mapped });
}

export async function createBlog(req: Request, res: Response) {
  const { title, body, excerpt, tags: tagNames } = req.body;
  const [result] = await db.insert(blogs).values({
    authorId: req.user!.id,
    title,
    body,
    slug: await uniqueSlug(title),
    excerpt: excerpt || `${body.trim().slice(0, 180)}${body.length > 180 ? '…' : ''}`,
    readMinutes: estimateReadMinutes(body),
    coverPath: req.file ? relativePath(req.file) : null,
  });

  const id = Number(result.insertId);
  await setTags('blog', id, tagNames ?? []);

  const [row] = await db
    .select({ blog: blogs, author: authorColumns })
    .from(blogs)
    .innerJoin(users, eq(blogs.authorId, users.id))
    .where(eq(blogs.id, id))
    .limit(1);
  const [mapped] = await decorate([row!], req.user!.id, true);
  res.status(201).json({ blog: mapped });
}

export async function updateBlog(req: Request, res: Response) {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(blogs).where(eq(blogs.id, id)).limit(1);
  if (!existing) throw ApiError.notFound('That article no longer exists.');
  if (existing.authorId !== req.user!.id) throw ApiError.forbidden('You can only edit your own articles.');

  const { title, body, excerpt, tags: tagNames } = req.body;
  const patch: Record<string, unknown> = {};
  if (title) patch.title = title;
  if (body) {
    patch.body = body;
    patch.readMinutes = estimateReadMinutes(body);
  }
  if (excerpt !== undefined) patch.excerpt = excerpt;
  if (req.file) {
    removeFile(existing.coverPath);
    patch.coverPath = relativePath(req.file);
  }
  if (Object.keys(patch).length) await db.update(blogs).set(patch).where(eq(blogs.id, id));
  if (tagNames) await setTags('blog', id, tagNames);

  const [row] = await db
    .select({ blog: blogs, author: authorColumns })
    .from(blogs)
    .innerJoin(users, eq(blogs.authorId, users.id))
    .where(eq(blogs.id, id))
    .limit(1);
  const [mapped] = await decorate([row!], req.user!.id, true);
  res.json({ blog: mapped });
}

export async function deleteBlog(req: Request, res: Response) {
  const id = Number(req.params.id);
  const [existing] = await db
    .select({ authorId: blogs.authorId, coverPath: blogs.coverPath })
    .from(blogs)
    .where(eq(blogs.id, id))
    .limit(1);
  if (!existing) throw ApiError.notFound('That article no longer exists.');
  if (existing.authorId !== req.user!.id && req.user!.role !== 'admin') {
    throw ApiError.forbidden('You can only delete your own articles.');
  }

  removeFile(existing.coverPath);
  await db.delete(blogs).where(eq(blogs.id, id));
  res.status(204).end();
}

export async function likeBlog(req: Request, res: Response) {
  const id = Number(req.params.id);
  const [blog] = await db.select({ authorId: blogs.authorId }).from(blogs).where(eq(blogs.id, id)).limit(1);
  if (!blog) throw ApiError.notFound('That article no longer exists.');

  const { liked, likeCount } = await toggleLike('blog', req.user!.id, id);

  if (liked) {
    await notify({
      recipientId: blog.authorId,
      actorId: req.user!.id,
      type: 'blog_like',
      message: 'liked your article',
      link: `/app/blogs/${id}`,
    });
  }
  res.json({ isLiked: liked, likeCount });
}

export async function bookmarkBlog(req: Request, res: Response) {
  const id = Number(req.params.id);
  const [exists] = await db.select({ id: blogs.id }).from(blogs).where(eq(blogs.id, id)).limit(1);
  if (!exists) throw ApiError.notFound('That article no longer exists.');
  const { bookmarked } = await toggleBookmark('blog', req.user!.id, id);
  res.json({ isBookmarked: bookmarked });
}

export async function listComments(req: Request, res: Response) {
  const page = getPageParams(req, 20, 50);
  const where = eq(blogComments.blogId, Number(req.params.id));

  const [rows, total] = await Promise.all([
    db
      .select({
        id: blogComments.id,
        body: blogComments.body,
        createdAt: blogComments.createdAt,
        authorId: blogComments.authorId,
        author: authorColumns,
      })
      .from(blogComments)
      .innerJoin(users, eq(blogComments.authorId, users.id))
      .where(where)
      .orderBy(desc(blogComments.createdAt), desc(blogComments.id))
      .limit(page.limit)
      .offset(page.skip),
    countRows(blogComments, where),
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
  const blogId = Number(req.params.id);
  const [blog] = await db.select({ authorId: blogs.authorId }).from(blogs).where(eq(blogs.id, blogId)).limit(1);
  if (!blog) throw ApiError.notFound('That article no longer exists.');

  const commentId = await db.transaction(async (tx) => {
    const [result] = await tx.insert(blogComments).values({ blogId, authorId: req.user!.id, body: req.body.body });
    await tx
      .update(blogs)
      .set({ commentCount: sql`${blogs.commentCount} + 1` })
      .where(eq(blogs.id, blogId));
    return Number(result.insertId);
  });

  await notify({
    recipientId: blog.authorId,
    actorId: req.user!.id,
    type: 'blog_comment',
    message: 'commented on your article',
    link: `/app/blogs/${blogId}`,
  });

  const [row] = await db
    .select({ id: blogComments.id, body: blogComments.body, createdAt: blogComments.createdAt, author: authorColumns })
    .from(blogComments)
    .innerJoin(users, eq(blogComments.authorId, users.id))
    .where(eq(blogComments.id, commentId))
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
    .select({ id: blogComments.id, authorId: blogComments.authorId, blogId: blogComments.blogId })
    .from(blogComments)
    .where(eq(blogComments.id, commentId))
    .limit(1);
  if (!comment) throw ApiError.notFound('That comment no longer exists.');
  if (comment.authorId !== req.user!.id && req.user!.role !== 'admin') {
    throw ApiError.forbidden('You can only delete your own comments.');
  }

  await db.transaction(async (tx) => {
    await tx.delete(blogComments).where(eq(blogComments.id, commentId));
    await tx
      .update(blogs)
      .set({ commentCount: sql`greatest(${blogs.commentCount} - 1, 0)` })
      .where(eq(blogs.id, comment.blogId));
  });

  res.status(204).end();
}
