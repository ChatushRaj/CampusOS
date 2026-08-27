import { Router, type Request, type Response } from 'express';
import { and, asc, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import type { MySqlTable, MySqlColumn } from 'drizzle-orm/mysql-core';
import { db } from '../../db/index.js';
import {
  blogs,
  connections,
  eventRsvps,
  events,
  feedback,
  jobApplications,
  jobs,
  listings,
  notices,
  postBookmarks,
  blogBookmarks,
  jobBookmarks,
  listingBookmarks,
  posts,
  users,
} from '../../db/schema.js';
import { countRows } from '../../db/helpers.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { mediaUrl } from '../../utils/media.js';
import { requireAuth } from '../../middleware/auth.js';
import { toUserSummary } from '../users/user.mapper.js';

const router = Router();
router.use(requireAuth);

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const authorColumns = {
  id: users.id,
  name: users.name,
  role: users.role,
  headline: users.headline,
  department: users.department,
  graduationYear: users.graduationYear,
  avatarPath: users.avatarPath,
};

/**
 * New rows per day over the last `days` days, zero-filled so the chart has no gaps.
 * GROUP BY on a date expression, which is what the equivalent aggregation looked like before.
 */
async function dailySeries(table: MySqlTable, column: MySqlColumn, days: number) {
  const since = daysAgo(days - 1);
  since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({ day: sql<string>`date(${column})`, count: sql<number>`count(*)` })
    .from(table)
    .where(gte(column, since))
    .groupBy(sql`date(${column})`);

  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = String(row.day).slice(0, 10);
    counts.set(key, Number(row.count));
  }

  return Array.from({ length: days }, (_, i) => {
    const date = daysAgo(days - 1 - i);
    const key = date.toISOString().slice(0, 10);
    return { date: key, count: counts.get(key) ?? 0 };
  });
}

/**
 * One endpoint, three shapes. Every figure is read from the database — the
 * dashboards in the source material displayed hard-coded numbers.
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { id, role } = req.user!;
    const now = new Date();

    const [upcomingEvents, latestNotices] = await Promise.all([
      db.select().from(events).where(gte(events.startsAt, now)).orderBy(asc(events.startsAt)).limit(4),
      db
        .select({ notice: notices, author: authorColumns })
        .from(notices)
        .innerJoin(users, eq(notices.postedBy, users.id))
        .where(or(isNull(notices.expiresAt), gte(notices.expiresAt, now))!)
        .orderBy(desc(notices.pinned), desc(notices.createdAt))
        .limit(4),
    ]);

    const shared = {
      upcomingEvents: upcomingEvents.map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: e.startsAt,
        venue: e.venue,
        category: e.category,
        coverUrl: mediaUrl(e.coverPath),
      })),
      latestNotices: latestNotices.map((r) => ({
        id: r.notice.id,
        title: r.notice.title,
        priority: r.notice.priority,
        category: r.notice.category,
        postedBy: toUserSummary(r.author),
        createdAt: r.notice.createdAt,
      })),
    };

    if (role === 'admin') {
      const [
        totalUsers,
        students,
        faculty,
        newThisWeek,
        totalPosts,
        totalBlogs,
        totalJobs,
        totalListings,
        openFeedback,
        signupSeries,
        postSeries,
        departments,
      ] = await Promise.all([
        countRows(users, eq(users.isActive, true)),
        countRows(users, and(eq(users.isActive, true), eq(users.role, 'student'))!),
        countRows(users, and(eq(users.isActive, true), eq(users.role, 'faculty'))!),
        countRows(users, gte(users.createdAt, daysAgo(7))),
        countRows(posts),
        countRows(blogs, eq(blogs.published, true)),
        countRows(jobs, gte(jobs.applyBy, now)),
        countRows(listings, eq(listings.status, 'available')),
        countRows(feedback, eq(feedback.status, 'open')),
        dailySeries(users, users.createdAt, 14),
        dailySeries(posts, posts.createdAt, 14),
        db
          .select({ label: users.department, count: sql<number>`count(*)` })
          .from(users)
          .where(and(eq(users.isActive, true), sql`${users.department} is not null`)!)
          .groupBy(users.department)
          .orderBy(sql`count(*) desc`)
          .limit(6),
      ]);

      return res.json({
        role,
        ...shared,
        stats: [
          { key: 'members', label: 'Active members', value: totalUsers, hint: `${newThisWeek} joined this week` },
          { key: 'students', label: 'Students', value: students },
          { key: 'faculty', label: 'Faculty', value: faculty },
          { key: 'posts', label: 'Posts', value: totalPosts },
          { key: 'blogs', label: 'Articles', value: totalBlogs },
          { key: 'jobs', label: 'Open roles', value: totalJobs },
          { key: 'listings', label: 'Marketplace items', value: totalListings },
          { key: 'feedback', label: 'Open reports', value: openFeedback },
        ],
        charts: {
          signups: signupSeries,
          posts: postSeries,
          departments: departments.map((d) => ({ label: d.label ?? 'Unspecified', count: Number(d.count) })),
        },
      });
    }

    if (role === 'faculty') {
      const myJobIds = (await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.postedBy, id))).map((r) => r.id);
      const myEventIds = (await db.select({ id: events.id }).from(events).where(eq(events.organiserId, id))).map(
        (r) => r.id,
      );

      const [myNotices, myEventCount, myJobCount, applications, rsvpTotal, applicationSeries, myOpenJobs] =
        await Promise.all([
          countRows(notices, eq(notices.postedBy, id)),
          Promise.resolve(myEventIds.length),
          Promise.resolve(myJobIds.length),
          myJobIds.length ? countRows(jobApplications, inArray(jobApplications.jobId, myJobIds)) : 0,
          myEventIds.length ? countRows(eventRsvps, inArray(eventRsvps.eventId, myEventIds)) : 0,
          dailySeries(jobApplications, jobApplications.createdAt, 14),
          db
            .select()
            .from(jobs)
            .where(and(eq(jobs.postedBy, id), gte(jobs.applyBy, now))!)
            .orderBy(asc(jobs.applyBy))
            .limit(5),
        ]);

      return res.json({
        role,
        ...shared,
        stats: [
          { key: 'notices', label: 'Notices posted', value: myNotices },
          { key: 'events', label: 'Events organised', value: myEventCount },
          { key: 'rsvps', label: 'Total RSVPs', value: rsvpTotal },
          { key: 'jobs', label: 'Roles posted', value: myJobCount },
          { key: 'applications', label: 'Applications received', value: applications },
        ],
        charts: { applications: applicationSeries },
        myJobs: myOpenJobs.map((j) => ({
          id: j.id,
          title: j.title,
          company: j.company,
          applyBy: j.applyBy,
          applicationCount: j.applicationCount,
        })),
      });
    }

    // Student view.
    const [myPosts, myBlogs, connectionCount, pendingRequests, myApplications, savedCounts, goingEventIds] =
      await Promise.all([
        countRows(posts, eq(posts.authorId, id)),
        countRows(blogs, eq(blogs.authorId, id)),
        countRows(
          connections,
          and(
            eq(connections.status, 'accepted'),
            or(eq(connections.requesterId, id), eq(connections.recipientId, id)),
          )!,
        ),
        countRows(connections, and(eq(connections.status, 'pending'), eq(connections.recipientId, id))!),
        countRows(jobApplications, eq(jobApplications.applicantId, id)),
        Promise.all([
          countRows(postBookmarks, eq(postBookmarks.userId, id)),
          countRows(blogBookmarks, eq(blogBookmarks.userId, id)),
          countRows(jobBookmarks, eq(jobBookmarks.userId, id)),
          countRows(listingBookmarks, eq(listingBookmarks.userId, id)),
        ]),
        db
          .select({ eventId: eventRsvps.eventId })
          .from(eventRsvps)
          .where(and(eq(eventRsvps.userId, id), eq(eventRsvps.status, 'going'))!),
      ]);

    const ids = goingEventIds.map((r) => r.eventId);
    const nextEvents = ids.length
      ? await db
          .select()
          .from(events)
          .where(and(inArray(events.id, ids), gte(events.startsAt, now))!)
          .orderBy(asc(events.startsAt))
          .limit(3)
      : [];

    res.json({
      role,
      ...shared,
      stats: [
        {
          key: 'connections',
          label: 'Connections',
          value: connectionCount,
          hint: pendingRequests ? `${pendingRequests} pending` : undefined,
        },
        { key: 'posts', label: 'Posts shared', value: myPosts },
        { key: 'blogs', label: 'Articles written', value: myBlogs },
        { key: 'applications', label: 'Applications sent', value: myApplications },
        { key: 'saved', label: 'Saved items', value: savedCounts.reduce((a, b) => a + b, 0) },
      ],
      myEvents: nextEvents.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, venue: e.venue })),
    });
  }),
);

export default router;
