import { Router, type Request, type Response } from 'express';
import { and, asc, desc, eq, gte, inArray, like, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { JOB_TYPES, WORK_MODES, jobApplications, jobSkills, jobs, users } from '../../db/schema.js';
import { countRows, toNumber } from '../../db/helpers.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { containsPattern, getPageParams, paginated } from '../../utils/pagination.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireStaff } from '../../middleware/auth.js';
import { toUserSummary } from '../users/user.mapper.js';
import { bookmarkedIds, toggleBookmark } from '../../services/engagement.service.js';

const idParam = z.object({ id: z.coerce.number().int().positive('That identifier is not valid') });

const jobBase = z.object({
  title: z.string().trim().min(3, 'Enter the role title').max(120),
  company: z.string().trim().min(2, 'Enter the company name').max(120),
  companyAbout: z.string().trim().max(2000).optional(),
  description: z.string().trim().min(20, 'Describe the role in at least 20 characters').max(8000),
  type: z.enum(JOB_TYPES, { errorMap: () => ({ message: 'Choose a role type' }) }),
  mode: z.enum(WORK_MODES).default('on-site'),
  location: z.string().trim().min(2, 'Enter a location').max(120),
  skills: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => {
      const list = Array.isArray(v) ? v : typeof v === 'string' && v.length ? v.split(',') : [];
      return [...new Set(list.map((s) => s.trim()).filter(Boolean))].slice(0, 12);
    }),
  openings: z.coerce.number().int().min(1).default(1),
  stipendMin: z.coerce.number().min(0).nullish(),
  stipendMax: z.coerce.number().min(0).nullish(),
  durationMonths: z.coerce.number().int().min(0).nullish(),
  startsOn: z.coerce.date().nullish(),
  applyBy: z.coerce.date({ invalid_type_error: 'Choose an application deadline' }),
  applyUrl: z.string().url('Enter a valid link').nullish().or(z.literal('')),
});

const jobBody = jobBase.refine((v) => v.stipendMax == null || v.stipendMin == null || v.stipendMax >= v.stipendMin, {
  message: 'The maximum stipend must be at least the minimum',
  path: ['stipendMax'],
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  q: z.string().trim().max(100).optional(),
  type: z.enum(JOB_TYPES).optional(),
  mode: z.enum(WORK_MODES).optional(),
  skill: z.string().trim().max(40).optional(),
  sort: z.enum(['recent', 'deadline']).default('recent'),
  includeExpired: z.coerce.boolean().default(false),
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

async function skillsFor(ids: number[]): Promise<Map<number, string[]>> {
  const grouped = new Map<number, string[]>();
  if (ids.length === 0) return grouped;
  const rows = await db
    .select({ jobId: jobSkills.jobId, skill: jobSkills.skill })
    .from(jobSkills)
    .where(inArray(jobSkills.jobId, ids));
  for (const row of rows) {
    const list = grouped.get(row.jobId) ?? [];
    list.push(row.skill);
    grouped.set(row.jobId, list);
  }
  return grouped;
}

function mapJob(
  row: any,
  skills: Map<number, string[]>,
  saved: Set<number>,
  applied: Set<number>,
  viewerRole: string,
  viewerId: number,
) {
  const j = row.job;
  return {
    id: j.id,
    title: j.title,
    company: j.company,
    companyAbout: j.companyAbout ?? '',
    description: j.description,
    type: j.type,
    mode: j.mode,
    location: j.location,
    skills: skills.get(j.id) ?? [],
    openings: j.openings,
    // DECIMAL arrives as a string from MySQL; the API contract promises a number.
    stipendMin: toNumber(j.stipendMin),
    stipendMax: toNumber(j.stipendMax),
    durationMonths: j.durationMonths,
    startsOn: j.startsOn,
    applyBy: j.applyBy,
    applyUrl: j.applyUrl,
    applicationCount: j.applicationCount,
    postedBy: toUserSummary(row.author),
    isBookmarked: saved.has(j.id),
    hasApplied: applied.has(j.id),
    isExpired: new Date(j.applyBy).getTime() < Date.now(),
    canManage: viewerRole === 'admin' || j.postedBy === viewerId,
    createdAt: j.createdAt,
  };
}

async function decorate(rows: any[], viewerId: number, viewerRole: string) {
  const ids = rows.map((r) => r.job.id as number);
  const [skills, saved, applications] = await Promise.all([
    skillsFor(ids),
    bookmarkedIds('job', viewerId, ids),
    ids.length
      ? db
          .select({ jobId: jobApplications.jobId })
          .from(jobApplications)
          .where(and(eq(jobApplications.applicantId, viewerId), inArray(jobApplications.jobId, ids))!)
      : [],
  ]);
  const applied = new Set(applications.map((a) => a.jobId));
  return rows.map((r) => mapJob(r, skills, saved, applied, viewerRole, viewerId));
}

async function setSkills(jobId: number, skills: string[]) {
  await db.delete(jobSkills).where(eq(jobSkills.jobId, jobId));
  if (skills.length) await db.insert(jobSkills).values(skills.map((skill) => ({ jobId, skill })));
}

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const page = getPageParams(req, 9, 30);
    const filters = [];

    if (!req.query.includeExpired) filters.push(gte(jobs.applyBy, new Date()));
    if (req.query.type) filters.push(eq(jobs.type, req.query.type as 'internship'));
    if (req.query.mode) filters.push(eq(jobs.mode, req.query.mode as 'on-site'));
    if (req.query.skill) {
      const matching = db
        .select({ id: jobSkills.jobId })
        .from(jobSkills)
        .where(eq(jobSkills.skill, String(req.query.skill)));
      filters.push(inArray(jobs.id, matching));
    }
    if (req.query.q) {
      const term = containsPattern(String(req.query.q));
      const match = or(like(jobs.title, term), like(jobs.company, term), like(jobs.location, term));
      if (match) filters.push(match);
    }

    const where = filters.length ? and(...filters)! : undefined;
    const base = db
      .select({ job: jobs, author: authorColumns })
      .from(jobs)
      .innerJoin(users, eq(jobs.postedBy, users.id));

    const [rows, total] = await Promise.all([
      (where ? base.where(where) : base)
        .orderBy(req.query.sort === 'deadline' ? asc(jobs.applyBy) : desc(jobs.createdAt), desc(jobs.id))
        .limit(page.limit)
        .offset(page.skip),
      countRows(jobs, where),
    ]);

    res.json(paginated(await decorate(rows, req.user!.id, req.user!.role), total, page));
  }),
);

router.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db
      .select({ job: jobs, author: authorColumns })
      .from(jobs)
      .innerJoin(users, eq(jobs.postedBy, users.id))
      .where(eq(jobs.id, Number(req.params.id)))
      .limit(1);
    if (!row) throw ApiError.notFound('That opening is no longer listed.');
    const [mapped] = await decorate([row], req.user!.id, req.user!.role);
    res.json({ job: mapped });
  }),
);

router.post(
  '/',
  requireStaff,
  validate({ body: jobBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { skills, applyUrl, stipendMin, stipendMax, startsOn, durationMonths, companyAbout, ...rest } = req.body;
    const [result] = await db.insert(jobs).values({
      ...rest,
      companyAbout: companyAbout || null,
      applyUrl: applyUrl || null,
      stipendMin: stipendMin != null ? String(stipendMin) : null,
      stipendMax: stipendMax != null ? String(stipendMax) : null,
      startsOn: startsOn ?? null,
      durationMonths: durationMonths ?? null,
      postedBy: req.user!.id,
    });

    const id = Number(result.insertId);
    await setSkills(id, skills ?? []);

    const [row] = await db
      .select({ job: jobs, author: authorColumns })
      .from(jobs)
      .innerJoin(users, eq(jobs.postedBy, users.id))
      .where(eq(jobs.id, id))
      .limit(1);
    const [mapped] = await decorate([row!], req.user!.id, req.user!.role);
    res.status(201).json({ job: mapped });
  }),
);

router.patch(
  '/:id',
  requireStaff,
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [existing] = await db.select({ postedBy: jobs.postedBy }).from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!existing) throw ApiError.notFound('That opening is no longer listed.');
    if (existing.postedBy !== req.user!.id && req.user!.role !== 'admin') {
      throw ApiError.forbidden('You can only edit openings you posted.');
    }

    const parsed = jobBase.partial().safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? 'Check the form.');

    const { skills, stipendMin, stipendMax, ...rest } = parsed.data;
    const patch: Record<string, unknown> = { ...rest };
    if (stipendMin !== undefined) patch.stipendMin = stipendMin === null ? null : String(stipendMin);
    if (stipendMax !== undefined) patch.stipendMax = stipendMax === null ? null : String(stipendMax);
    if (Object.keys(patch).length) await db.update(jobs).set(patch).where(eq(jobs.id, id));
    if (skills) await setSkills(id, skills);

    const [row] = await db
      .select({ job: jobs, author: authorColumns })
      .from(jobs)
      .innerJoin(users, eq(jobs.postedBy, users.id))
      .where(eq(jobs.id, id))
      .limit(1);
    const [mapped] = await decorate([row!], req.user!.id, req.user!.role);
    res.json({ job: mapped });
  }),
);

router.delete(
  '/:id',
  requireStaff,
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [existing] = await db.select({ postedBy: jobs.postedBy }).from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!existing) throw ApiError.notFound('That opening is no longer listed.');
    if (existing.postedBy !== req.user!.id && req.user!.role !== 'admin') {
      throw ApiError.forbidden('You can only delete openings you posted.');
    }
    await db.delete(jobs).where(eq(jobs.id, id));
    res.status(204).end();
  }),
);

router.post(
  '/:id/bookmark',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [exists] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!exists) throw ApiError.notFound('That opening is no longer listed.');
    const { bookmarked } = await toggleBookmark('job', req.user!.id, id);
    res.json({ isBookmarked: bookmarked });
  }),
);

router.post(
  '/:id/apply',
  validate({ params: idParam, body: z.object({ note: z.string().trim().max(1000).optional() }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const jobId = Number(req.params.id);

    await db.transaction(async (tx) => {
      const [job] = await tx.select({ applyBy: jobs.applyBy }).from(jobs).where(eq(jobs.id, jobId)).limit(1);
      if (!job) throw ApiError.notFound('That opening is no longer listed.');
      if (new Date(job.applyBy).getTime() < Date.now()) {
        throw ApiError.badRequest('Applications for this role have closed.');
      }

      const [existing] = await tx
        .select({ id: jobApplications.id })
        .from(jobApplications)
        .where(and(eq(jobApplications.jobId, jobId), eq(jobApplications.applicantId, req.user!.id))!)
        .limit(1);
      if (existing) throw ApiError.conflict('You have already applied to this role.');

      await tx.insert(jobApplications).values({ jobId, applicantId: req.user!.id, note: req.body.note ?? '' });
      await tx
        .update(jobs)
        .set({ applicationCount: sql`${jobs.applicationCount} + 1` })
        .where(eq(jobs.id, jobId));
    });

    res.status(201).json({ message: 'Application submitted.', hasApplied: true });
  }),
);

/** The poster, or an admin, reviews who applied. */
router.get(
  '/:id/applications',
  requireStaff,
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const jobId = Number(req.params.id);
    const [job] = await db.select({ postedBy: jobs.postedBy }).from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) throw ApiError.notFound('That opening is no longer listed.');
    if (job.postedBy !== req.user!.id && req.user!.role !== 'admin') {
      throw ApiError.forbidden('You can only review applications for your own openings.');
    }

    const page = getPageParams(req, 20, 50);
    const where = eq(jobApplications.jobId, jobId);
    const [rows, total] = await Promise.all([
      db
        .select({ application: jobApplications, author: authorColumns })
        .from(jobApplications)
        .innerJoin(users, eq(jobApplications.applicantId, users.id))
        .where(where)
        .orderBy(desc(jobApplications.createdAt), desc(jobApplications.id))
        .limit(page.limit)
        .offset(page.skip),
      countRows(jobApplications, where),
    ]);

    const items = rows.map((r) => ({
      id: r.application.id,
      note: r.application.note,
      status: r.application.status,
      applicant: toUserSummary(r.author),
      createdAt: r.application.createdAt,
    }));
    res.json(paginated(items, total, page));
  }),
);

export default router;
