import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  date,
  datetime,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

/* ------------------------------------------------------------------ */
/* Shared column helpers                                               */
/* ------------------------------------------------------------------ */

const createdAt = timestamp('created_at').notNull().defaultNow();
const updatedAt = timestamp('updated_at').notNull().defaultNow().onUpdateNow();

export const ROLES = ['student', 'faculty', 'admin'] as const;

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

export const users = mysqlTable(
  'users',
  {
    id: int('id').autoincrement().primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    email: varchar('email', { length: 160 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: mysqlEnum('role', ROLES).notNull().default('student'),
    rollNumber: varchar('roll_number', { length: 24 }),
    department: varchar('department', { length: 80 }),
    graduationYear: smallint('graduation_year'),
    headline: varchar('headline', { length: 120 }).notNull().default(''),
    bio: varchar('bio', { length: 600 }).notNull().default(''),
    avatarPath: varchar('avatar_path', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    // Bumped on password change to invalidate every refresh token issued before it.
    tokenVersion: int('token_version').notNull().default(0),
    lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email),
    uniqueIndex('users_roll_number_unique').on(t.rollNumber),
    index('users_role_idx').on(t.role),
    index('users_department_year_idx').on(t.department, t.graduationYear),
    index('users_name_idx').on(t.name),
  ],
);

/** Interests are their own rows rather than a delimited string, so they can be searched and joined. */
export const userInterests = mysqlTable(
  'user_interests',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    interest: varchar('interest', { length: 30 }).notNull(),
  },
  (t) => [uniqueIndex('user_interests_unique').on(t.userId, t.interest), index('user_interests_lookup').on(t.interest)],
);

/* ------------------------------------------------------------------ */
/* Tags (shared vocabulary across posts and articles)                  */
/* ------------------------------------------------------------------ */

export const tags = mysqlTable(
  'tags',
  {
    id: int('id').autoincrement().primaryKey(),
    name: varchar('name', { length: 30 }).notNull(),
  },
  (t) => [uniqueIndex('tags_name_unique').on(t.name)],
);

/* ------------------------------------------------------------------ */
/* Posts                                                               */
/* ------------------------------------------------------------------ */

export const posts = mysqlTable(
  'posts',
  {
    id: int('id').autoincrement().primaryKey(),
    authorId: int('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    visibility: mysqlEnum('visibility', ['campus', 'connections']).notNull().default('campus'),
    // Denormalised counters keep the feed to a single query instead of an aggregate per row.
    likeCount: int('like_count').notNull().default(0),
    commentCount: int('comment_count').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [index('posts_created_idx').on(t.createdAt), index('posts_author_created_idx').on(t.authorId, t.createdAt)],
);

export const postImages = mysqlTable(
  'post_images',
  {
    id: int('id').autoincrement().primaryKey(),
    postId: int('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    path: varchar('path', { length: 255 }).notNull(),
    position: smallint('position').notNull().default(0),
  },
  (t) => [index('post_images_post_idx').on(t.postId, t.position)],
);

export const postTags = mysqlTable(
  'post_tags',
  {
    postId: int('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    tagId: int('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] }), index('post_tags_tag_idx').on(t.tagId)],
);

/* ------------------------------------------------------------------ */
/* Articles                                                            */
/* ------------------------------------------------------------------ */

export const blogs = mysqlTable(
  'blogs',
  {
    id: int('id').autoincrement().primaryKey(),
    authorId: int('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 140 }).notNull(),
    slug: varchar('slug', { length: 160 }).notNull(),
    excerpt: varchar('excerpt', { length: 300 }).notNull().default(''),
    body: text('body').notNull(),
    coverPath: varchar('cover_path', { length: 255 }),
    readMinutes: smallint('read_minutes').notNull().default(1),
    published: boolean('published').notNull().default(true),
    likeCount: int('like_count').notNull().default(0),
    commentCount: int('comment_count').notNull().default(0),
    viewCount: int('view_count').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('blogs_slug_unique').on(t.slug),
    index('blogs_created_idx').on(t.createdAt),
    index('blogs_author_idx').on(t.authorId),
    index('blogs_popular_idx').on(t.published, t.likeCount),
  ],
);

export const blogTags = mysqlTable(
  'blog_tags',
  {
    blogId: int('blog_id')
      .notNull()
      .references(() => blogs.id, { onDelete: 'cascade' }),
    tagId: int('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.blogId, t.tagId] }), index('blog_tags_tag_idx').on(t.tagId)],
);

/* ------------------------------------------------------------------ */
/* Engagement                                                          */
/*                                                                     */
/* Likes, bookmarks and comments get one table per parent rather than  */
/* a polymorphic (target_type, target_id) pair. A polymorphic column   */
/* cannot carry a foreign key, so orphaned rows become possible the    */
/* moment a parent is deleted. One table per parent keeps referential  */
/* integrity and cascade deletes in the database.                      */
/* ------------------------------------------------------------------ */

export const postLikes = mysqlTable(
  'post_likes',
  {
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: int('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    createdAt,
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] }), index('post_likes_post_idx').on(t.postId)],
);

export const blogLikes = mysqlTable(
  'blog_likes',
  {
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blogId: int('blog_id')
      .notNull()
      .references(() => blogs.id, { onDelete: 'cascade' }),
    createdAt,
  },
  (t) => [primaryKey({ columns: [t.userId, t.blogId] }), index('blog_likes_blog_idx').on(t.blogId)],
);

export const postComments = mysqlTable(
  'post_comments',
  {
    id: int('id').autoincrement().primaryKey(),
    postId: int('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    authorId: int('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: varchar('body', { length: 1000 }).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [index('post_comments_post_idx').on(t.postId, t.createdAt)],
);

export const blogComments = mysqlTable(
  'blog_comments',
  {
    id: int('id').autoincrement().primaryKey(),
    blogId: int('blog_id')
      .notNull()
      .references(() => blogs.id, { onDelete: 'cascade' }),
    authorId: int('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: varchar('body', { length: 1000 }).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [index('blog_comments_blog_idx').on(t.blogId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Notices                                                             */
/* ------------------------------------------------------------------ */

export const NOTICE_CATEGORIES = ['academic', 'examination', 'placement', 'facility', 'general'] as const;
export const NOTICE_PRIORITIES = ['normal', 'important', 'urgent'] as const;

export const notices = mysqlTable(
  'notices',
  {
    id: int('id').autoincrement().primaryKey(),
    postedBy: int('posted_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 160 }).notNull(),
    body: text('body').notNull(),
    category: mysqlEnum('category', NOTICE_CATEGORIES).notNull().default('general'),
    priority: mysqlEnum('priority', NOTICE_PRIORITIES).notNull().default('normal'),
    attachmentUrl: varchar('attachment_url', { length: 500 }),
    // A notice leaves the board on its own rather than being deleted.
    expiresAt: datetime('expires_at'),
    pinned: boolean('pinned').notNull().default(false),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('notices_board_idx').on(t.pinned, t.createdAt),
    index('notices_category_idx').on(t.category),
    index('notices_expiry_idx').on(t.expiresAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

export const EVENT_CATEGORIES = ['workshop', 'cultural', 'sports', 'seminar', 'hackathon', 'other'] as const;
export const RSVP_STATUSES = ['going', 'interested'] as const;

export const events = mysqlTable(
  'events',
  {
    id: int('id').autoincrement().primaryKey(),
    organiserId: int('organiser_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 160 }).notNull(),
    description: text('description'),
    category: mysqlEnum('category', EVENT_CATEGORIES).notNull().default('other'),
    startsAt: datetime('starts_at').notNull(),
    endsAt: datetime('ends_at'),
    venue: varchar('venue', { length: 160 }).notNull(),
    coverPath: varchar('cover_path', { length: 255 }),
    registrationUrl: varchar('registration_url', { length: 500 }),
    capacity: int('capacity'),
    goingCount: int('going_count').notNull().default(0),
    interestedCount: int('interested_count').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [index('events_starts_idx').on(t.startsAt), index('events_category_idx').on(t.category, t.startsAt)],
);

export const eventRsvps = mysqlTable(
  'event_rsvps',
  {
    eventId: int('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: mysqlEnum('status', RSVP_STATUSES).notNull(),
    createdAt,
    updatedAt,
  },
  // One RSVP per person per event, enforced by the primary key.
  (t) => [primaryKey({ columns: [t.eventId, t.userId] }), index('event_rsvps_user_idx').on(t.userId)],
);

/* ------------------------------------------------------------------ */
/* Placements                                                          */
/* ------------------------------------------------------------------ */

export const JOB_TYPES = ['internship', 'full-time', 'part-time', 'freelance'] as const;
export const WORK_MODES = ['on-site', 'remote', 'hybrid'] as const;
export const APPLICATION_STATUSES = ['submitted', 'shortlisted', 'rejected'] as const;

export const jobs = mysqlTable(
  'jobs',
  {
    id: int('id').autoincrement().primaryKey(),
    postedBy: int('posted_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 120 }).notNull(),
    company: varchar('company', { length: 120 }).notNull(),
    companyAbout: text('company_about'),
    description: text('description').notNull(),
    type: mysqlEnum('type', JOB_TYPES).notNull(),
    mode: mysqlEnum('mode', WORK_MODES).notNull().default('on-site'),
    location: varchar('location', { length: 120 }).notNull(),
    openings: smallint('openings').notNull().default(1),
    stipendMin: decimal('stipend_min', { precision: 12, scale: 2 }),
    stipendMax: decimal('stipend_max', { precision: 12, scale: 2 }),
    durationMonths: smallint('duration_months'),
    startsOn: date('starts_on'),
    applyBy: datetime('apply_by').notNull(),
    applyUrl: varchar('apply_url', { length: 500 }),
    applicationCount: int('application_count').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('jobs_deadline_idx').on(t.applyBy),
    index('jobs_filter_idx').on(t.type, t.mode, t.applyBy),
    index('jobs_posted_by_idx').on(t.postedBy),
  ],
);

export const jobSkills = mysqlTable(
  'job_skills',
  {
    id: int('id').autoincrement().primaryKey(),
    jobId: int('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    skill: varchar('skill', { length: 40 }).notNull(),
  },
  (t) => [uniqueIndex('job_skills_unique').on(t.jobId, t.skill), index('job_skills_lookup').on(t.skill)],
);

export const jobApplications = mysqlTable(
  'job_applications',
  {
    id: int('id').autoincrement().primaryKey(),
    jobId: int('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    applicantId: int('applicant_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    note: varchar('note', { length: 1000 }).notNull().default(''),
    resumeUrl: varchar('resume_url', { length: 500 }),
    status: mysqlEnum('status', APPLICATION_STATUSES).notNull().default('submitted'),
    createdAt,
    updatedAt,
  },
  // Nobody applies to the same posting twice.
  (t) => [
    uniqueIndex('job_applications_unique').on(t.jobId, t.applicantId),
    index('job_applications_applicant_idx').on(t.applicantId, t.createdAt),
  ],
);

export const jobBookmarks = mysqlTable(
  'job_bookmarks',
  {
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: int('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    createdAt,
  },
  (t) => [primaryKey({ columns: [t.userId, t.jobId] })],
);

/* ------------------------------------------------------------------ */
/* Marketplace                                                         */
/* ------------------------------------------------------------------ */

export const LISTING_CATEGORIES = ['books', 'electronics', 'furniture', 'cycles', 'tickets', 'other'] as const;
export const LISTING_CONDITIONS = ['new', 'like-new', 'used'] as const;
export const LISTING_STATUSES = ['available', 'reserved', 'sold'] as const;

export const listings = mysqlTable(
  'listings',
  {
    id: int('id').autoincrement().primaryKey(),
    sellerId: int('seller_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 100 }).notNull(),
    description: varchar('description', { length: 2000 }).notNull().default(''),
    category: mysqlEnum('category', LISTING_CATEGORIES).notNull().default('other'),
    condition: mysqlEnum('item_condition', LISTING_CONDITIONS).notNull().default('used'),
    // Money is decimal, never float: 0.1 + 0.2 must equal 0.3 on an invoice.
    price: decimal('price', { precision: 10, scale: 2 }).notNull(),
    contact: varchar('contact', { length: 120 }).notNull(),
    status: mysqlEnum('status', LISTING_STATUSES).notNull().default('available'),
    likeCount: int('like_count').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('listings_browse_idx').on(t.status, t.createdAt),
    index('listings_category_price_idx').on(t.category, t.price),
    index('listings_seller_idx').on(t.sellerId),
  ],
);

export const listingImages = mysqlTable(
  'listing_images',
  {
    id: int('id').autoincrement().primaryKey(),
    listingId: int('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    path: varchar('path', { length: 255 }).notNull(),
    position: smallint('position').notNull().default(0),
  },
  (t) => [index('listing_images_listing_idx').on(t.listingId, t.position)],
);

export const listingLikes = mysqlTable(
  'listing_likes',
  {
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: int('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    createdAt,
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

export const postBookmarks = mysqlTable(
  'post_bookmarks',
  {
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: int('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    createdAt,
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] }), index('post_bookmarks_recent_idx').on(t.userId, t.createdAt)],
);

export const blogBookmarks = mysqlTable(
  'blog_bookmarks',
  {
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blogId: int('blog_id')
      .notNull()
      .references(() => blogs.id, { onDelete: 'cascade' }),
    createdAt,
  },
  (t) => [primaryKey({ columns: [t.userId, t.blogId] })],
);

export const listingBookmarks = mysqlTable(
  'listing_bookmarks',
  {
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: int('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    createdAt,
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

/* ------------------------------------------------------------------ */
/* Polls                                                               */
/* ------------------------------------------------------------------ */

export const polls = mysqlTable(
  'polls',
  {
    id: int('id').autoincrement().primaryKey(),
    authorId: int('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    question: varchar('question', { length: 200 }).notNull(),
    closesAt: datetime('closes_at'),
    totalVotes: int('total_votes').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [index('polls_created_idx').on(t.createdAt)],
);

export const pollOptions = mysqlTable(
  'poll_options',
  {
    id: int('id').autoincrement().primaryKey(),
    pollId: int('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 80 }).notNull(),
    voteCount: int('vote_count').notNull().default(0),
    position: smallint('position').notNull().default(0),
  },
  (t) => [index('poll_options_poll_idx').on(t.pollId, t.position)],
);

export const pollVotes = mysqlTable(
  'poll_votes',
  {
    pollId: int('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    optionId: int('option_id')
      .notNull()
      .references(() => pollOptions.id, { onDelete: 'cascade' }),
    createdAt,
  },
  // One vote per person per poll.
  (t) => [primaryKey({ columns: [t.pollId, t.userId] }), index('poll_votes_option_idx').on(t.optionId)],
);

/* ------------------------------------------------------------------ */
/* Connections, notifications, feedback                                */
/* ------------------------------------------------------------------ */

export const CONNECTION_STATUSES = ['pending', 'accepted'] as const;

/**
 * One row represents the relationship in both directions, replacing the three
 * parallel arrays the original design kept on each user document.
 */
export const connections = mysqlTable(
  'connections',
  {
    id: int('id').autoincrement().primaryKey(),
    requesterId: int('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientId: int('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: mysqlEnum('status', CONNECTION_STATUSES).notNull().default('pending'),
    respondedAt: timestamp('responded_at'),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('connections_pair_unique').on(t.requesterId, t.recipientId),
    index('connections_inbox_idx').on(t.recipientId, t.status),
    index('connections_outbox_idx').on(t.requesterId, t.status),
  ],
);

export const NOTIFICATION_TYPES = [
  'post_like',
  'post_comment',
  'blog_like',
  'blog_comment',
  'connection_request',
  'connection_accepted',
  'notice_posted',
  'event_created',
] as const;

export const notifications = mysqlTable(
  'notifications',
  {
    id: int('id').autoincrement().primaryKey(),
    recipientId: int('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorId: int('actor_id').references(() => users.id, { onDelete: 'set null' }),
    type: mysqlEnum('type', NOTIFICATION_TYPES).notNull(),
    message: varchar('message', { length: 240 }).notNull(),
    link: varchar('link', { length: 255 }),
    isRead: boolean('is_read').notNull().default(false),
    createdAt,
  },
  (t) => [index('notifications_inbox_idx').on(t.recipientId, t.isRead, t.createdAt)],
);

export const FEEDBACK_CATEGORIES = ['bug', 'suggestion', 'content', 'other'] as const;
export const FEEDBACK_STATUSES = ['open', 'in-review', 'resolved'] as const;

export const feedback = mysqlTable(
  'feedback',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subject: varchar('subject', { length: 140 }).notNull(),
    body: varchar('body', { length: 3000 }).notNull(),
    category: mysqlEnum('category', FEEDBACK_CATEGORIES).notNull().default('other'),
    screenshotPath: varchar('screenshot_path', { length: 255 }),
    status: mysqlEnum('status', FEEDBACK_STATUSES).notNull().default('open'),
    createdAt,
    updatedAt,
  },
  (t) => [index('feedback_triage_idx').on(t.status, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Study groups                                                        */
/* ------------------------------------------------------------------ */

export const GROUP_CATEGORIES = [
  'academic',
  'coding',
  'projects',
  'creative',
  'fitness',
  'languages',
  'other',
] as const;

export const studyGroups = mysqlTable(
  'study_groups',
  {
    id: int('id').autoincrement().primaryKey(),
    ownerId: int('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    description: varchar('description', { length: 600 }).notNull().default(''),
    category: mysqlEnum('category', GROUP_CATEGORIES).notNull().default('other'),
    memberCount: int('member_count').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('study_groups_name_unique').on(t.name),
    index('study_groups_browse_idx').on(t.category, t.memberCount),
  ],
);

export const groupMembers = mysqlTable(
  'group_members',
  {
    groupId: int('group_id')
      .notNull()
      .references(() => studyGroups.id, { onDelete: 'cascade' }),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: mysqlEnum('role', ['owner', 'member']).notNull().default('member'),
    createdAt,
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] }), index('group_members_user_idx').on(t.userId)],
);

export const groupDiscussions = mysqlTable(
  'group_discussions',
  {
    id: int('id').autoincrement().primaryKey(),
    groupId: int('group_id')
      .notNull()
      .references(() => studyGroups.id, { onDelete: 'cascade' }),
    authorId: int('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: varchar('body', { length: 2000 }).notNull(),
    replyCount: int('reply_count').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [index('group_discussions_group_idx').on(t.groupId, t.createdAt)],
);

export const groupReplies = mysqlTable(
  'group_replies',
  {
    id: int('id').autoincrement().primaryKey(),
    discussionId: int('discussion_id')
      .notNull()
      .references(() => groupDiscussions.id, { onDelete: 'cascade' }),
    authorId: int('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: varchar('body', { length: 1000 }).notNull(),
    createdAt,
  },
  (t) => [index('group_replies_discussion_idx').on(t.discussionId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Relations (used by Drizzle's relational query API)                  */
/* ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  blogs: many(blogs),
  interests: many(userInterests),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  images: many(postImages),
  tags: many(postTags),
}));

export const blogsRelations = relations(blogs, ({ one, many }) => ({
  author: one(users, { fields: [blogs.authorId], references: [users.id] }),
  tags: many(blogTags),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  seller: one(users, { fields: [listings.sellerId], references: [users.id] }),
  images: many(listingImages),
}));

export const pollsRelations = relations(polls, ({ one, many }) => ({
  author: one(users, { fields: [polls.authorId], references: [users.id] }),
  options: many(pollOptions),
}));

export type UserRow = typeof users.$inferSelect;
export type PostRow = typeof posts.$inferSelect;
export type BlogRow = typeof blogs.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type ListingRow = typeof listings.$inferSelect;
export type NoticeRow = typeof notices.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type Role = (typeof ROLES)[number];

// Referenced so the import is used even when no query needs raw SQL yet.
export const nowSql = sql`now()`;
