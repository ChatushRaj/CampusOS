import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  blogBookmarks,
  blogLikes,
  blogs,
  jobBookmarks,
  listingBookmarks,
  listingLikes,
  listings,
  postBookmarks,
  postLikes,
  posts,
} from '../db/schema.js';

export type LikeKind = 'post' | 'blog' | 'listing';
export type BookmarkKind = 'post' | 'blog' | 'job' | 'listing';

/**
 * Each kind is written out rather than built from column metadata. Drizzle's
 * `.set()` and `.values()` key off the TypeScript property name, not the SQL
 * column name, so a dynamically assembled key silently targets nothing.
 * Explicit branches keep this type-checked.
 */

/** Which of these items has the viewer already liked? One query for the whole page. */
export async function likedIds(kind: LikeKind, userId: number | undefined, ids: number[]): Promise<Set<number>> {
  if (!userId || ids.length === 0) return new Set();

  if (kind === 'post') {
    const rows = await db
      .select({ id: postLikes.postId })
      .from(postLikes)
      .where(and(eq(postLikes.userId, userId), inArray(postLikes.postId, ids))!);
    return new Set(rows.map((r) => r.id));
  }
  if (kind === 'blog') {
    const rows = await db
      .select({ id: blogLikes.blogId })
      .from(blogLikes)
      .where(and(eq(blogLikes.userId, userId), inArray(blogLikes.blogId, ids))!);
    return new Set(rows.map((r) => r.id));
  }
  const rows = await db
    .select({ id: listingLikes.listingId })
    .from(listingLikes)
    .where(and(eq(listingLikes.userId, userId), inArray(listingLikes.listingId, ids))!);
  return new Set(rows.map((r) => r.id));
}

export async function bookmarkedIds(
  kind: BookmarkKind,
  userId: number | undefined,
  ids: number[],
): Promise<Set<number>> {
  if (!userId || ids.length === 0) return new Set();

  if (kind === 'post') {
    const rows = await db
      .select({ id: postBookmarks.postId })
      .from(postBookmarks)
      .where(and(eq(postBookmarks.userId, userId), inArray(postBookmarks.postId, ids))!);
    return new Set(rows.map((r) => r.id));
  }
  if (kind === 'blog') {
    const rows = await db
      .select({ id: blogBookmarks.blogId })
      .from(blogBookmarks)
      .where(and(eq(blogBookmarks.userId, userId), inArray(blogBookmarks.blogId, ids))!);
    return new Set(rows.map((r) => r.id));
  }
  if (kind === 'job') {
    const rows = await db
      .select({ id: jobBookmarks.jobId })
      .from(jobBookmarks)
      .where(and(eq(jobBookmarks.userId, userId), inArray(jobBookmarks.jobId, ids))!);
    return new Set(rows.map((r) => r.id));
  }
  const rows = await db
    .select({ id: listingBookmarks.listingId })
    .from(listingBookmarks)
    .where(and(eq(listingBookmarks.userId, userId), inArray(listingBookmarks.listingId, ids))!);
  return new Set(rows.map((r) => r.id));
}

/**
 * Toggles a like and moves the parent's counter in the same transaction, so the
 * row and the number that counts it can never disagree. GREATEST keeps the
 * counter from going negative if rows were ever removed out of band.
 */
export async function toggleLike(
  kind: LikeKind,
  userId: number,
  targetId: number,
): Promise<{ liked: boolean; likeCount: number }> {
  return db.transaction(async (tx) => {
    let liked: boolean;
    let likeCount = 0;

    if (kind === 'post') {
      const where = and(eq(postLikes.userId, userId), eq(postLikes.postId, targetId))!;
      const [existing] = await tx
        .select({ one: sql<number>`1` })
        .from(postLikes)
        .where(where)
        .limit(1);
      if (existing) {
        await tx.delete(postLikes).where(where);
        await tx
          .update(posts)
          .set({ likeCount: sql`greatest(${posts.likeCount} - 1, 0)` })
          .where(eq(posts.id, targetId));
      } else {
        await tx.insert(postLikes).values({ userId, postId: targetId });
        await tx
          .update(posts)
          .set({ likeCount: sql`${posts.likeCount} + 1` })
          .where(eq(posts.id, targetId));
      }
      liked = !existing;
      const [row] = await tx.select({ value: posts.likeCount }).from(posts).where(eq(posts.id, targetId)).limit(1);
      likeCount = Number(row?.value ?? 0);
    } else if (kind === 'blog') {
      const where = and(eq(blogLikes.userId, userId), eq(blogLikes.blogId, targetId))!;
      const [existing] = await tx
        .select({ one: sql<number>`1` })
        .from(blogLikes)
        .where(where)
        .limit(1);
      if (existing) {
        await tx.delete(blogLikes).where(where);
        await tx
          .update(blogs)
          .set({ likeCount: sql`greatest(${blogs.likeCount} - 1, 0)` })
          .where(eq(blogs.id, targetId));
      } else {
        await tx.insert(blogLikes).values({ userId, blogId: targetId });
        await tx
          .update(blogs)
          .set({ likeCount: sql`${blogs.likeCount} + 1` })
          .where(eq(blogs.id, targetId));
      }
      liked = !existing;
      const [row] = await tx.select({ value: blogs.likeCount }).from(blogs).where(eq(blogs.id, targetId)).limit(1);
      likeCount = Number(row?.value ?? 0);
    } else {
      const where = and(eq(listingLikes.userId, userId), eq(listingLikes.listingId, targetId))!;
      const [existing] = await tx
        .select({ one: sql<number>`1` })
        .from(listingLikes)
        .where(where)
        .limit(1);
      if (existing) {
        await tx.delete(listingLikes).where(where);
        await tx
          .update(listings)
          .set({ likeCount: sql`greatest(${listings.likeCount} - 1, 0)` })
          .where(eq(listings.id, targetId));
      } else {
        await tx.insert(listingLikes).values({ userId, listingId: targetId });
        await tx
          .update(listings)
          .set({ likeCount: sql`${listings.likeCount} + 1` })
          .where(eq(listings.id, targetId));
      }
      liked = !existing;
      const [row] = await tx
        .select({ value: listings.likeCount })
        .from(listings)
        .where(eq(listings.id, targetId))
        .limit(1);
      likeCount = Number(row?.value ?? 0);
    }

    return { liked, likeCount };
  });
}

export async function toggleBookmark(
  kind: BookmarkKind,
  userId: number,
  targetId: number,
): Promise<{ bookmarked: boolean }> {
  if (kind === 'post') {
    const where = and(eq(postBookmarks.userId, userId), eq(postBookmarks.postId, targetId))!;
    const [existing] = await db
      .select({ one: sql<number>`1` })
      .from(postBookmarks)
      .where(where)
      .limit(1);
    if (existing) {
      await db.delete(postBookmarks).where(where);
      return { bookmarked: false };
    }
    await db.insert(postBookmarks).values({ userId, postId: targetId });
    return { bookmarked: true };
  }
  if (kind === 'blog') {
    const where = and(eq(blogBookmarks.userId, userId), eq(blogBookmarks.blogId, targetId))!;
    const [existing] = await db
      .select({ one: sql<number>`1` })
      .from(blogBookmarks)
      .where(where)
      .limit(1);
    if (existing) {
      await db.delete(blogBookmarks).where(where);
      return { bookmarked: false };
    }
    await db.insert(blogBookmarks).values({ userId, blogId: targetId });
    return { bookmarked: true };
  }
  if (kind === 'job') {
    const where = and(eq(jobBookmarks.userId, userId), eq(jobBookmarks.jobId, targetId))!;
    const [existing] = await db
      .select({ one: sql<number>`1` })
      .from(jobBookmarks)
      .where(where)
      .limit(1);
    if (existing) {
      await db.delete(jobBookmarks).where(where);
      return { bookmarked: false };
    }
    await db.insert(jobBookmarks).values({ userId, jobId: targetId });
    return { bookmarked: true };
  }
  const where = and(eq(listingBookmarks.userId, userId), eq(listingBookmarks.listingId, targetId))!;
  const [existing] = await db
    .select({ one: sql<number>`1` })
    .from(listingBookmarks)
    .where(where)
    .limit(1);
  if (existing) {
    await db.delete(listingBookmarks).where(where);
    return { bookmarked: false };
  }
  await db.insert(listingBookmarks).values({ userId, listingId: targetId });
  return { bookmarked: true };
}
