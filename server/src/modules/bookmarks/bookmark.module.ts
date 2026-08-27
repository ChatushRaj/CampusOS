import { Router, type Request, type Response } from 'express';
import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  blogBookmarks,
  blogs,
  jobBookmarks,
  jobs,
  listingBookmarks,
  listingImages,
  listings,
  postBookmarks,
  postImages,
  posts,
  users,
} from '../../db/schema.js';
import { toNumber } from '../../db/helpers.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getPageParams, paginated } from '../../utils/pagination.js';
import { mediaUrl, mediaUrls } from '../../utils/media.js';
import { requireAuth } from '../../middleware/auth.js';
import { toUserSummary } from '../users/user.mapper.js';

const authorColumns = {
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

/**
 * One place to see everything saved, across all content types.
 *
 * Because each content type has its own bookmark table, the combined list is a
 * UNION over four small indexed queries rather than a scan of one wide
 * polymorphic table. The union carries only (type, id, saved_at), so the page
 * is decided before any content row is read.
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const page = getPageParams(req, 12, 40);
    const userId = req.user!.id;
    const type = String(req.query.type ?? '');
    const wanted = ['post', 'blog', 'job', 'listing'].includes(type) ? [type] : ['post', 'blog', 'job', 'listing'];

    const parts = [
      wanted.includes('post')
        ? db
            .select({ kind: sql<string>`'post'`, id: postBookmarks.postId, savedAt: postBookmarks.createdAt })
            .from(postBookmarks)
            .where(eq(postBookmarks.userId, userId))
        : null,
      wanted.includes('blog')
        ? db
            .select({ kind: sql<string>`'blog'`, id: blogBookmarks.blogId, savedAt: blogBookmarks.createdAt })
            .from(blogBookmarks)
            .where(eq(blogBookmarks.userId, userId))
        : null,
      wanted.includes('job')
        ? db
            .select({ kind: sql<string>`'job'`, id: jobBookmarks.jobId, savedAt: jobBookmarks.createdAt })
            .from(jobBookmarks)
            .where(eq(jobBookmarks.userId, userId))
        : null,
      wanted.includes('listing')
        ? db
            .select({
              kind: sql<string>`'listing'`,
              id: listingBookmarks.listingId,
              savedAt: listingBookmarks.createdAt,
            })
            .from(listingBookmarks)
            .where(eq(listingBookmarks.userId, userId))
        : null,
    ].filter(Boolean) as { kind: string; id: number; savedAt: Date }[][] & unknown[];

    const all: { kind: string; id: number; savedAt: Date }[] = [];
    for (const part of parts) all.push(...((await part) as { kind: string; id: number; savedAt: Date }[]));

    all.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    const total = all.length;
    const slice = all.slice(page.skip, page.skip + page.limit);

    const idsOf = (kind: string) => slice.filter((r) => r.kind === kind).map((r) => r.id);
    const postIds = idsOf('post');
    const blogIds = idsOf('blog');
    const jobIds = idsOf('job');
    const listingIds = idsOf('listing');

    const [postRows, blogRows, jobRows, listingRows, postPics, listingPics] = await Promise.all([
      postIds.length
        ? db
            .select({ post: posts, author: authorColumns })
            .from(posts)
            .innerJoin(users, eq(posts.authorId, users.id))
            .where(inArray(posts.id, postIds))
        : [],
      blogIds.length
        ? db
            .select({ blog: blogs, author: authorColumns })
            .from(blogs)
            .innerJoin(users, eq(blogs.authorId, users.id))
            .where(inArray(blogs.id, blogIds))
        : [],
      jobIds.length
        ? db
            .select({ job: jobs, author: authorColumns })
            .from(jobs)
            .innerJoin(users, eq(jobs.postedBy, users.id))
            .where(inArray(jobs.id, jobIds))
        : [],
      listingIds.length
        ? db
            .select({ listing: listings, author: authorColumns })
            .from(listings)
            .innerJoin(users, eq(listings.sellerId, users.id))
            .where(inArray(listings.id, listingIds))
        : [],
      postIds.length ? db.select().from(postImages).where(inArray(postImages.postId, postIds)) : [],
      listingIds.length ? db.select().from(listingImages).where(inArray(listingImages.listingId, listingIds)) : [],
    ]);

    const firstPostImage = new Map<number, string>();
    for (const img of postPics) if (!firstPostImage.has(img.postId)) firstPostImage.set(img.postId, img.path);
    const firstListingImage = new Map<number, string>();
    for (const img of listingPics)
      if (!firstListingImage.has(img.listingId)) firstListingImage.set(img.listingId, img.path);

    const index = new Map<string, Record<string, unknown>>();
    for (const r of postRows)
      index.set(`post:${r.post.id}`, {
        id: r.post.id,
        title: r.post.body.slice(0, 90),
        subtitle: 'Post',
        images: mediaUrls([firstPostImage.get(r.post.id)].filter(Boolean) as string[]),
        author: toUserSummary(r.author),
        href: `/app/posts/${r.post.id}`,
      });
    for (const r of blogRows)
      index.set(`blog:${r.blog.id}`, {
        id: r.blog.id,
        title: r.blog.title,
        subtitle: `${r.blog.readMinutes} min read`,
        images: [mediaUrl(r.blog.coverPath)].filter(Boolean),
        author: toUserSummary(r.author),
        href: `/app/blogs/${r.blog.id}`,
      });
    for (const r of jobRows)
      index.set(`job:${r.job.id}`, {
        id: r.job.id,
        title: r.job.title,
        subtitle: `${r.job.company} · ${r.job.location}`,
        images: [],
        author: toUserSummary(r.author),
        href: `/app/jobs/${r.job.id}`,
      });
    for (const r of listingRows)
      index.set(`listing:${r.listing.id}`, {
        id: r.listing.id,
        title: r.listing.title,
        subtitle: `₹${toNumber(r.listing.price) ?? 0}`,
        images: mediaUrls([firstListingImage.get(r.listing.id)].filter(Boolean) as string[]),
        author: toUserSummary(r.author),
        href: `/app/marketplace/${r.listing.id}`,
      });

    // A bookmark whose target was deleted is dropped rather than shown as a blank row.
    const items = slice
      .map((row) => {
        const entry = index.get(`${row.kind}:${row.id}`);
        return entry ? { ...entry, type: row.kind, savedAt: row.savedAt } : null;
      })
      .filter(Boolean);

    res.json(paginated(items, total, page));
  }),
);

export default router;
