import { Router, type Request, type Response } from 'express';
import { and, asc, desc, eq, inArray, like, lte, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  LISTING_STATUSES,
  listingImages,
  listings,
  users,
} from '../../db/schema.js';
import { countRows, toNumber } from '../../db/helpers.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { containsPattern, getPageParams, paginated } from '../../utils/pagination.js';
import { mediaUrls } from '../../utils/media.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rateLimit.js';
import { imageUpload, relativePaths, removeFile } from '../../middleware/upload.js';
import { toUserSummary } from '../users/user.mapper.js';
import { bookmarkedIds, likedIds, toggleBookmark, toggleLike } from '../../services/engagement.service.js';

const idParam = z.object({ id: z.coerce.number().int().positive('That identifier is not valid') });

const listingBody = z.object({
  title: z.string().trim().min(3, 'Describe what you are selling').max(100),
  description: z.string().trim().max(2000).optional(),
  category: z.enum(LISTING_CATEGORIES).default('other'),
  condition: z.enum(LISTING_CONDITIONS).default('used'),
  price: z.coerce.number().min(0, 'Enter a price of zero or more'),
  contact: z.string().trim().min(3, 'Add a way for buyers to reach you').max(120),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  q: z.string().trim().max(100).optional(),
  category: z.enum(LISTING_CATEGORIES).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  status: z.enum(LISTING_STATUSES).optional(),
  sort: z.enum(['recent', 'price-asc', 'price-desc']).default('recent'),
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

async function imagesFor(ids: number[]): Promise<Map<number, string[]>> {
  const grouped = new Map<number, string[]>();
  if (ids.length === 0) return grouped;
  const rows = await db
    .select({ listingId: listingImages.listingId, path: listingImages.path })
    .from(listingImages)
    .where(inArray(listingImages.listingId, ids))
    .orderBy(asc(listingImages.position));
  for (const row of rows) {
    const list = grouped.get(row.listingId) ?? [];
    list.push(row.path);
    grouped.set(row.listingId, list);
  }
  return grouped;
}

function mapListing(
  row: any,
  images: Map<number, string[]>,
  liked: Set<number>,
  saved: Set<number>,
  viewerRole: string,
  viewerId: number,
) {
  const l = row.listing;
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    category: l.category,
    condition: l.condition,
    price: toNumber(l.price) ?? 0,
    images: mediaUrls(images.get(l.id) ?? []),
    contact: l.contact,
    status: l.status,
    likeCount: l.likeCount,
    seller: toUserSummary(row.author),
    isLiked: liked.has(l.id),
    isBookmarked: saved.has(l.id),
    canManage: viewerRole === 'admin' || l.sellerId === viewerId,
    createdAt: l.createdAt,
  };
}

async function decorate(rows: any[], viewerId: number, viewerRole: string) {
  const ids = rows.map((r) => r.listing.id as number);
  const [images, liked, saved] = await Promise.all([
    imagesFor(ids),
    likedIds('listing', viewerId, ids),
    bookmarkedIds('listing', viewerId, ids),
  ]);
  return rows.map((r) => mapListing(r, images, liked, saved, viewerRole, viewerId));
}

const router = Router();
const images = imageUpload('listings');
router.use(requireAuth);

router.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const page = getPageParams(req, 12, 40);
    const filters = [eq(listings.status, (req.query.status ?? 'available') as 'available')];

    if (req.query.category) filters.push(eq(listings.category, req.query.category as 'other'));
    if (req.query.maxPrice != null) filters.push(lte(listings.price, String(req.query.maxPrice)));
    if (req.query.q) {
      const term = containsPattern(String(req.query.q));
      const match = or(like(listings.title, term), like(listings.description, term));
      if (match) filters.push(match);
    }

    const where = and(...filters)!;
    const order =
      req.query.sort === 'price-asc'
        ? asc(listings.price)
        : req.query.sort === 'price-desc'
          ? desc(listings.price)
          : desc(listings.createdAt);
    // Secondary sort keeps paging stable when two rows share a price or timestamp.

    const [rows, total] = await Promise.all([
      db
        .select({ listing: listings, author: authorColumns })
        .from(listings)
        .innerJoin(users, eq(listings.sellerId, users.id))
        .where(where)
        .orderBy(order, desc(listings.id))
        .limit(page.limit)
        .offset(page.skip),
      countRows(listings, where),
    ]);

    res.json(paginated(await decorate(rows, req.user!.id, req.user!.role), total, page));
  }),
);

router.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db
      .select({ listing: listings, author: authorColumns })
      .from(listings)
      .innerJoin(users, eq(listings.sellerId, users.id))
      .where(eq(listings.id, Number(req.params.id)))
      .limit(1);
    if (!row) throw ApiError.notFound('That listing is no longer available.');
    const [mapped] = await decorate([row], req.user!.id, req.user!.role);
    res.json({ listing: mapped });
  }),
);

router.post(
  '/',
  writeLimiter,
  images.array('images', 4),
  validate({ body: listingBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const paths = relativePaths(files);
    const { price, description, ...rest } = req.body;

    const id = await db.transaction(async (tx) => {
      const [result] = await tx.insert(listings).values({
        ...rest,
        description: description ?? '',
        price: String(price),
        sellerId: req.user!.id,
      });
      const listingId = Number(result.insertId);
      if (paths.length) {
        await tx.insert(listingImages).values(paths.map((path, position) => ({ listingId, path, position })));
      }
      return listingId;
    });

    const [row] = await db
      .select({ listing: listings, author: authorColumns })
      .from(listings)
      .innerJoin(users, eq(listings.sellerId, users.id))
      .where(eq(listings.id, id))
      .limit(1);
    const [mapped] = await decorate([row!], req.user!.id, req.user!.role);
    res.status(201).json({ listing: mapped });
  }),
);

router.patch(
  '/:id',
  validate({
    params: idParam,
    body: listingBody.partial().extend({ status: z.enum(LISTING_STATUSES).optional() }),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [existing] = await db
      .select({ sellerId: listings.sellerId })
      .from(listings)
      .where(eq(listings.id, id))
      .limit(1);
    if (!existing) throw ApiError.notFound('That listing is no longer available.');
    if (existing.sellerId !== req.user!.id) throw ApiError.forbidden('You can only edit your own listings.');

    const { price, ...rest } = req.body;
    const patch: Record<string, unknown> = { ...rest };
    if (price !== undefined) patch.price = String(price);
    if (Object.keys(patch).length) await db.update(listings).set(patch).where(eq(listings.id, id));

    const [row] = await db
      .select({ listing: listings, author: authorColumns })
      .from(listings)
      .innerJoin(users, eq(listings.sellerId, users.id))
      .where(eq(listings.id, id))
      .limit(1);
    const [mapped] = await decorate([row!], req.user!.id, req.user!.role);
    res.json({ listing: mapped });
  }),
);

router.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [existing] = await db
      .select({ sellerId: listings.sellerId })
      .from(listings)
      .where(eq(listings.id, id))
      .limit(1);
    if (!existing) throw ApiError.notFound('That listing is no longer available.');
    if (existing.sellerId !== req.user!.id && req.user!.role !== 'admin') {
      throw ApiError.forbidden('You can only delete your own listings.');
    }

    const files = await db
      .select({ path: listingImages.path })
      .from(listingImages)
      .where(eq(listingImages.listingId, id));
    await db.delete(listings).where(eq(listings.id, id));
    for (const file of files) removeFile(file.path);

    res.status(204).end();
  }),
);

router.post(
  '/:id/like',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [exists] = await db.select({ id: listings.id }).from(listings).where(eq(listings.id, id)).limit(1);
    if (!exists) throw ApiError.notFound('That listing is no longer available.');
    const { liked, likeCount } = await toggleLike('listing', req.user!.id, id);
    res.json({ isLiked: liked, likeCount });
  }),
);

router.post(
  '/:id/bookmark',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [exists] = await db.select({ id: listings.id }).from(listings).where(eq(listings.id, id)).limit(1);
    if (!exists) throw ApiError.notFound('That listing is no longer available.');
    const { bookmarked } = await toggleBookmark('listing', req.user!.id, id);
    res.json({ isBookmarked: bookmarked });
  }),
);

export default router;
