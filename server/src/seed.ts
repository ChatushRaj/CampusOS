/**
 * Seeds a realistic development dataset.
 * Run with `npm run seed`. Refuses to run against a production database.
 */
import { sql } from 'drizzle-orm';
import { connectDatabase, db, disconnectDatabase } from './db/index.js';
import {
  blogTags,
  blogs,
  connections,
  eventRsvps,
  events,
  jobSkills,
  jobs,
  listings,
  notices,
  pollOptions,
  polls,
  studyGroups,
  groupMembers,
  groupDiscussions,
  groupReplies,
  postComments,
  postLikes,
  postTags,
  posts,
  tags,
  userInterests,
  users,
} from './db/schema.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { hashPassword } from './modules/auth/auth.controller.js';
import { estimateReadMinutes, slugify } from './modules/blogs/blog.schema.js';

const DEMO_PASSWORD = 'CampusOS2025';
const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

async function seed() {
  if (env.isProd) throw new Error('Refusing to seed a production database.');

  await connectDatabase();
  logger.info('Clearing existing rows');

  // Truncating in dependency order with the FK check disabled is faster than
  // deleting row by row, and it resets AUTO_INCREMENT so ids start at 1.
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  for (const table of [
    'group_replies',
    'group_discussions',
    'group_members',
    'study_groups',
    'poll_votes',
    'poll_options',
    'polls',
    'event_rsvps',
    'events',
    'job_applications',
    'job_bookmarks',
    'job_skills',
    'jobs',
    'listing_bookmarks',
    'listing_likes',
    'listing_images',
    'listings',
    'post_bookmarks',
    'post_likes',
    'post_comments',
    'post_images',
    'post_tags',
    'posts',
    'blog_bookmarks',
    'blog_likes',
    'blog_comments',
    'blog_tags',
    'blogs',
    'notices',
    'notifications',
    'feedback',
    'connections',
    'user_interests',
    'tags',
    'users',
  ]) {
    await db.execute(sql.raw(`TRUNCATE TABLE \`${table}\``));
  }
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await db.insert(users).values([
    {
      name: 'Chatush Raj',
      email: 'admin@campusos.dev',
      passwordHash,
      role: 'admin',
      department: 'Computer Science',
      headline: 'Platform administrator',
      bio: 'Keeps the campus platform running.',
    },
    {
      name: 'Dr. Anita Menon',
      email: 'faculty@campusos.dev',
      passwordHash,
      role: 'faculty',
      department: 'Computer Science',
      headline: 'Associate Professor, Distributed Systems',
      bio: 'Teaches operating systems and coordinates placements.',
    },
    {
      name: 'Rahul Verma',
      email: 'rahul@campusos.dev',
      passwordHash,
      role: 'student',
      rollNumber: 'CS22B1042',
      department: 'Computer Science',
      graduationYear: 2026,
      headline: 'Third year · backend and databases',
      bio: 'Building small tools, mostly in Go and MySQL.',
    },
    {
      name: 'Priya Nair',
      email: 'priya@campusos.dev',
      passwordHash,
      role: 'student',
      rollNumber: 'EC22B1108',
      department: 'Electronics',
      graduationYear: 2026,
      headline: 'Embedded systems · robotics club lead',
      bio: 'Robotics club lead. Currently teaching a quadruped to walk.',
    },
    {
      name: 'Arjun Desai',
      email: 'arjun@campusos.dev',
      passwordHash,
      role: 'student',
      rollNumber: 'ME23B1077',
      department: 'Mechanical',
      graduationYear: 2027,
      headline: 'Second year · Formula student team',
      bio: 'Suspension subsystem on the Formula Student car.',
    },
    {
      name: 'Sneha Iyer',
      email: 'sneha@campusos.dev',
      passwordHash,
      role: 'student',
      rollNumber: 'CS23B1015',
      department: 'Computer Science',
      graduationYear: 2027,
      headline: 'Second year · design and frontend',
      bio: 'Interface design, typography, and far too many side projects.',
    },
  ]);

  const [ADMIN, FACULTY, RAHUL, PRIYA, ARJUN, SNEHA] = [1, 2, 3, 4, 5, 6];
  logger.info('Created 6 users');

  await db.insert(userInterests).values([
    { userId: RAHUL, interest: 'backend' },
    { userId: RAHUL, interest: 'databases' },
    { userId: RAHUL, interest: 'chess' },
    { userId: PRIYA, interest: 'robotics' },
    { userId: PRIYA, interest: 'embedded' },
    { userId: PRIYA, interest: 'photography' },
    { userId: ARJUN, interest: 'automotive' },
    { userId: ARJUN, interest: 'cad' },
    { userId: SNEHA, interest: 'design' },
    { userId: SNEHA, interest: 'frontend' },
  ]);

  await db.insert(connections).values([
    { requesterId: RAHUL, recipientId: PRIYA, status: 'accepted', respondedAt: new Date() },
    { requesterId: RAHUL, recipientId: SNEHA, status: 'accepted', respondedAt: new Date() },
    { requesterId: ARJUN, recipientId: RAHUL, status: 'pending' },
    { requesterId: PRIYA, recipientId: SNEHA, status: 'accepted', respondedAt: new Date() },
  ]);

  await db
    .insert(tags)
    .values(
      [
        'robotics',
        'clubs',
        'webdev',
        'academics',
        'formulastudent',
        'databases',
        'infrastructure',
        'design',
        'mobile',
        'teams',
      ].map((name) => ({ name })),
    );
  const tagRows = await db.select().from(tags);
  const tagId = (name: string) => tagRows.find((t) => t.name === name)!.id;

  await db.insert(posts).values([
    {
      authorId: PRIYA,
      body: 'The robotics lab is open to second years from this week. Bring a laptop and a project idea — we have three spare kits.',
      likeCount: 2,
      commentCount: 1,
    },
    {
      authorId: RAHUL,
      body: 'Spent the weekend rewriting our club site to render on the server instead of the client. First paint went from 2.4s to 0.6s on campus wifi.',
      likeCount: 1,
      commentCount: 1,
    },
    {
      authorId: SNEHA,
      body: 'Does anyone have last year\u2019s compiler design question papers? Happy to trade for my operating systems notes.',
    },
    {
      authorId: ARJUN,
      body: 'Formula Student chassis is out of the jig. Six weeks until the Coimbatore event.',
      likeCount: 1,
    },
  ]);

  await db.insert(postTags).values([
    { postId: 1, tagId: tagId('robotics') },
    { postId: 1, tagId: tagId('clubs') },
    { postId: 2, tagId: tagId('webdev') },
    { postId: 3, tagId: tagId('academics') },
    { postId: 4, tagId: tagId('formulastudent') },
  ]);

  await db.insert(postComments).values([
    { postId: 1, authorId: RAHUL, body: 'What kits are they? I have a spare ESP32 if that helps.' },
    { postId: 2, authorId: SNEHA, body: 'Would love to read a writeup of what you changed.' },
  ]);

  await db.insert(postLikes).values([
    { userId: RAHUL, postId: 1 },
    { userId: SNEHA, postId: 1 },
    { userId: PRIYA, postId: 2 },
    { userId: PRIYA, postId: 4 },
  ]);

  const articles = [
    {
      authorId: RAHUL,
      title: 'What I learned running a database in a hostel room',
      body: 'A year ago I moved our club project off a shared host and onto a spare machine under my desk. The uptime was terrible for the first month and excellent for the eleven that followed. This is what changed in between.\n\nThe first thing to go wrong was not the database. It was the power. Hostel supply cuts out twice a week, and an unclean shutdown on a write-heavy workload will corrupt exactly the file you care about. A twenty minute UPS solved more problems than any amount of query tuning.\n\nThe second thing was backups. I had them, in the sense that a cron job wrote a dump to the same disk the database lived on. That is not a backup, it is a second copy of a file that will die at the same moment as the original. Moving dumps to a cheap object store cost less per month than a canteen lunch.\n\nThe third thing was indexes, and this is the part I expected. Our slowest page ran a query that scanned every row in a table of forty thousand records, every time anyone opened the homepage. One composite index took it from 900ms to 4ms. I had read about this in a course and still did not recognise it until I turned on the slow query log.\n\nThe lesson I keep coming back to: infrastructure fails in the order of how boring it is. Power, then storage, then the interesting parts.',
      tagNames: ['databases', 'infrastructure'],
    },
    {
      authorId: SNEHA,
      title: 'Designing for the ten seconds before a lecture starts',
      body: 'Most campus software is designed as though people sit down at a desk to use it. They do not. They use it walking between blocks, in a lift, in the ten seconds after an announcement and before a lecture starts.\n\nThat changes what matters. Density beats beauty. If a notice takes two taps to read, it will not be read. If the timetable needs a pinch to zoom, nobody checks it between classes.\n\nI spent a week watching people use our department portal on their phones. Three patterns showed up every time. People scan for a date first, not a title. They tap the wrong thing when targets are under about forty pixels. And they abandon anything that shows a spinner for more than a second or two, then complain the site is broken.\n\nNone of this is a new finding. It is in every mobile guideline written in the last decade. The interesting part is how consistently campus software ignores it, because it is usually built by people testing on a laptop while sitting still.\n\nWhat I changed: dates moved to the front of every row, tap targets went up to forty-four pixels, and every list renders skeleton rows instead of a spinner. Complaints about the site being slow dropped even though nothing about the server changed.',
      tagNames: ['design', 'mobile'],
    },
    {
      authorId: PRIYA,
      title: 'Six mistakes our robotics team made, ranked by cost',
      body: 'We finished fourth this year, up from ninth. Most of the improvement came from not repeating the following.\n\nSixth: buying the expensive motor driver first. We spent a third of the budget before we knew what current the drivetrain would actually draw. Prototype with cheap parts, then buy once you have measured something.\n\nFifth: no version control on the firmware. Two people editing the same file over a shared drive is not collaboration, it is a slow-motion merge conflict.\n\nFourth: testing on carpet. The competition surface was polished concrete. Our traction assumptions were wrong by a factor we did not discover until the first heat.\n\nThird: one person owning the wiring. When she had exams, nothing could be repaired.\n\nSecond: leaving the battery mount to the end. It ended up being the heaviest single decision on the robot, made in the last week, badly.\n\nFirst, and by a wide margin: not writing down why we made decisions. We re-litigated the same three arguments across two semesters because nobody could remember what we had ruled out and why. A shared document with dated entries would have saved more time than any technical fix on this list.',
      tagNames: ['robotics', 'teams'],
    },
  ];

  for (const [i, article] of articles.entries()) {
    await db.insert(blogs).values({
      authorId: article.authorId,
      title: article.title,
      slug: slugify(article.title),
      excerpt: `${article.body.slice(0, 170)}…`,
      body: article.body,
      readMinutes: estimateReadMinutes(article.body),
      likeCount: 4 + i * 3,
      viewCount: 60 + i * 45,
    });
    await db.insert(blogTags).values(article.tagNames.map((name) => ({ blogId: i + 1, tagId: tagId(name) })));
  }
  logger.info('Created 3 articles');

  await db.insert(notices).values([
    {
      postedBy: FACULTY,
      title: 'End semester examination timetable published',
      body: 'The timetable for the odd semester examinations is now available on the department noticeboard and the academic portal. Report to the hall thirty minutes before each paper with your identity card. Requests for clash resolution close on the 20th.',
      category: 'examination',
      priority: 'important',
      pinned: true,
      expiresAt: days(30),
    },
    {
      postedBy: ADMIN,
      title: 'Library extends hours during examinations',
      body: 'The central library will stay open until 2:00 AM from the 15th through the end of the examination period. The reading hall on the second floor remains open around the clock. Bring your identity card for entry after 10:00 PM.',
      category: 'facility',
      expiresAt: days(25),
    },
    {
      postedBy: FACULTY,
      title: 'Placement registration closes Friday',
      body: 'Final year students must complete placement registration by 5:00 PM on Friday. Upload a current resume and confirm your specialisation. Registrations submitted after the deadline cannot be included in the first drive.',
      category: 'placement',
      priority: 'urgent',
      expiresAt: days(5),
    },
    {
      postedBy: ADMIN,
      title: 'Water supply interruption in hostel blocks C and D',
      body: 'Maintenance work on the overhead tank will interrupt supply to blocks C and D on Saturday between 9:00 AM and 2:00 PM. Storage tanks on each floor will be filled beforehand.',
      category: 'facility',
      expiresAt: days(7),
    },
  ]);
  logger.info('Created 4 notices');

  await db.insert(events).values([
    {
      organiserId: FACULTY,
      title: 'Systems design workshop: building for scale',
      description:
        'A hands-on session covering caching, database indexing and queue-based decoupling. Bring a laptop with Docker installed. Open to second year students and above.',
      category: 'workshop',
      startsAt: days(4),
      endsAt: days(4),
      venue: 'CS Seminar Hall, Block A',
      capacity: 60,
      goingCount: 2,
      interestedCount: 1,
    },
    {
      organiserId: ADMIN,
      title: 'Inter-department hackathon',
      description:
        'Thirty-six hours, teams of four, one theme announced at the start. Meals provided. Registration closes two days before the event.',
      category: 'hackathon',
      startsAt: days(12),
      endsAt: days(14),
      venue: 'Innovation Centre',
      capacity: 200,
      goingCount: 1,
    },
    {
      organiserId: FACULTY,
      title: 'Guest lecture: careers in embedded systems',
      description: 'A visiting engineer discusses the path from campus projects to production hardware.',
      category: 'seminar',
      startsAt: days(8),
      venue: 'Electronics Auditorium',
      interestedCount: 2,
    },
    {
      organiserId: ADMIN,
      title: 'Annual cultural night',
      description: 'Music, dance and the departmental showcase. Open to all students and staff.',
      category: 'cultural',
      startsAt: days(21),
      venue: 'Open Air Theatre',
    },
  ]);

  await db.insert(eventRsvps).values([
    { eventId: 1, userId: RAHUL, status: 'going' },
    { eventId: 1, userId: SNEHA, status: 'going' },
    { eventId: 1, userId: PRIYA, status: 'interested' },
    { eventId: 2, userId: ARJUN, status: 'going' },
    { eventId: 3, userId: RAHUL, status: 'interested' },
    { eventId: 3, userId: PRIYA, status: 'interested' },
  ]);
  logger.info('Created 4 events');

  const jobRows: (typeof jobs.$inferInsert)[] = [
    {
      postedBy: FACULTY,
      title: 'Backend engineering intern',
      company: 'Northwind Systems',
      companyAbout: 'A logistics platform used by regional freight operators across South India.',
      description:
        'Work with the platform team on the shipment tracking service. You will write Go, work with MySQL, and ship to production in your first fortnight. We are looking for someone comfortable reading unfamiliar code and asking direct questions.',
      type: 'internship' as const,
      mode: 'hybrid' as const,
      location: 'Chennai',
      openings: 3,
      stipendMin: '25000.00',
      stipendMax: '35000.00',
      durationMonths: 6,
      startsOn: days(30),
      applyBy: days(14),
    },
    {
      postedBy: FACULTY,
      title: 'Product design intern',
      company: 'Lumen Labs',
      companyAbout: 'A small studio building tools for independent teachers.',
      description:
        'Own a feature end to end, from research through to shipped interface. You will work directly with two engineers and the founder. A portfolio matters more than a resume for this role.',
      type: 'internship' as const,
      mode: 'remote' as const,
      location: 'Remote',
      openings: 1,
      stipendMin: '20000.00',
      durationMonths: 4,
      applyBy: days(9),
    },
    {
      postedBy: ADMIN,
      title: 'Graduate embedded engineer',
      company: 'Kavelle Instruments',
      companyAbout: 'Builds measurement hardware for industrial process control.',
      description:
        'A full time role for final year electronics students. You will work on firmware for sensor modules, including bring-up of new boards and calibration routines. Experience with a real hardware project counts for a great deal here.',
      type: 'full-time' as const,
      mode: 'on-site' as const,
      location: 'Pune',
      openings: 4,
      stipendMin: '700000.00',
      stipendMax: '950000.00',
      startsOn: days(120),
      applyBy: days(28),
    },
  ];
  await db.insert(jobs).values(jobRows);

  await db.insert(jobSkills).values([
    { jobId: 1, skill: 'Go' },
    { jobId: 1, skill: 'MySQL' },
    { jobId: 1, skill: 'REST' },
    { jobId: 2, skill: 'Figma' },
    { jobId: 2, skill: 'User research' },
    { jobId: 2, skill: 'Prototyping' },
    { jobId: 3, skill: 'C' },
    { jobId: 3, skill: 'ARM' },
    { jobId: 3, skill: 'RTOS' },
    { jobId: 3, skill: 'Oscilloscope' },
  ]);
  logger.info('Created 3 job postings');

  await db.insert(listings).values([
    {
      sellerId: ARJUN,
      title: 'Casio FX-991EX scientific calculator',
      description:
        'Used for two semesters, everything works, slight scuff on the cover. Selling because I have upgraded.',
      category: 'electronics',
      condition: 'used',
      price: '800.00',
      contact: 'arjun@campusos.dev',
    },
    {
      sellerId: SNEHA,
      title: 'Data structures and algorithms textbook set',
      description: 'Three books, minimal highlighting, no torn pages. Covers the full second year syllabus.',
      category: 'books',
      condition: 'like-new',
      price: '1200.00',
      contact: 'sneha@campusos.dev',
    },
    {
      sellerId: RAHUL,
      title: 'Single speed cycle, 21 inch frame',
      description: 'Serviced last month, new brake pads and tyres. Ideal for getting between blocks. Lock included.',
      category: 'cycles',
      condition: 'used',
      price: '4500.00',
      contact: 'rahul@campusos.dev',
    },
    {
      sellerId: PRIYA,
      title: 'Study desk lamp with clamp',
      description: 'Warm and cool modes, clamps to any hostel desk. Barely used.',
      category: 'furniture',
      condition: 'like-new',
      price: '650.00',
      contact: 'priya@campusos.dev',
    },
  ]);
  logger.info('Created 4 marketplace listings');

  await db.insert(polls).values([
    {
      authorId: ADMIN,
      question: 'What should the library extend first during examinations?',
      totalVotes: 50,
      closesAt: days(6),
    },
    { authorId: PRIYA, question: 'Which workshop would you attend next month?', totalVotes: 37 },
  ]);

  await db.insert(pollOptions).values([
    { pollId: 1, label: 'Longer opening hours', voteCount: 14, position: 0 },
    { pollId: 1, label: 'More group study rooms', voteCount: 9, position: 1 },
    { pollId: 1, label: 'Additional power outlets', voteCount: 21, position: 2 },
    { pollId: 1, label: 'Quiet floor enforcement', voteCount: 6, position: 3 },
    { pollId: 2, label: 'PCB design', voteCount: 12, position: 0 },
    { pollId: 2, label: 'Machine learning basics', voteCount: 18, position: 1 },
    { pollId: 2, label: 'Public speaking', voteCount: 7, position: 2 },
  ]);

  await db.insert(studyGroups).values([
    {
      ownerId: RAHUL,
      name: 'Database internals',
      description: 'Working through query planning, indexing and transaction isolation. Weekly problem sets.',
      category: 'academic',
      memberCount: 3,
    },
    {
      ownerId: PRIYA,
      name: 'Robotics build club',
      description: 'Hardware, firmware and the occasional argument about gear ratios.',
      category: 'projects',
      memberCount: 2,
    },
    {
      ownerId: SNEHA,
      name: 'Interface design critique',
      description: 'Bring something you made. Leave with notes you did not want but needed.',
      category: 'creative',
      memberCount: 2,
    },
  ]);

  await db.insert(groupMembers).values([
    { groupId: 1, userId: RAHUL, role: 'owner' as const },
    { groupId: 1, userId: SNEHA },
    { groupId: 1, userId: ARJUN },
    { groupId: 2, userId: PRIYA, role: 'owner' as const },
    { groupId: 2, userId: ARJUN },
    { groupId: 3, userId: SNEHA, role: 'owner' as const },
    { groupId: 3, userId: RAHUL },
  ]);

  await db.insert(groupDiscussions).values([
    {
      groupId: 1,
      authorId: RAHUL,
      body: 'Starting on isolation levels this week. Read the chapter on repeatable read before Thursday and bring one example where it surprised you.',
      replyCount: 2,
    },
    {
      groupId: 1,
      authorId: SNEHA,
      body: 'Does anyone have a good explanation of why a covering index helps so much? I understand what it does, not why it is that much faster.',
      replyCount: 1,
    },
    {
      groupId: 3,
      authorId: SNEHA,
      body: 'Critique session Friday. Bring one screen you are unhappy with rather than one you are proud of.',
    },
  ]);

  await db.insert(groupReplies).values([
    { discussionId: 1, authorId: SNEHA, body: 'Read it. The phantom read example took me three attempts to follow.' },
    { discussionId: 1, authorId: ARJUN, body: 'Same. I will bring the one from the lab exercise.' },
    {
      discussionId: 2,
      authorId: RAHUL,
      body: 'Because the index alone answers the query, so the engine never touches the table rows at all.',
    },
  ]);
  logger.info('Created 3 study groups');

  logger.info('Seed complete');
  logger.info(`Sign in with any of these accounts using the password: ${DEMO_PASSWORD}`);
  logger.info('  admin@campusos.dev    (admin)');
  logger.info('  faculty@campusos.dev  (faculty)');
  logger.info('  rahul@campusos.dev    (student)');

  await disconnectDatabase();
}

seed().catch(async (err) => {
  logger.error({ err }, 'Seed failed');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
