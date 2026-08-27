import './setup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(here, '..', 'sql', 'schema.sql'), 'utf8');
// Comments explain the choices below; they are not part of the schema.
const sql = raw.replace(/--[^\n]*/g, '');

// The Drizzle schema and the hand-written SQL describe the same database.
// These tests keep the two in step without needing a live server.
const schema = await import('../dist/db/schema.js');

const tableNames = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);

test('schema.sql defines every table the application queries', () => {
  const required = [
    'users',
    'user_interests',
    'tags',
    'posts',
    'post_images',
    'post_tags',
    'post_likes',
    'post_comments',
    'post_bookmarks',
    'blogs',
    'blog_tags',
    'blog_likes',
    'blog_comments',
    'blog_bookmarks',
    'notices',
    'events',
    'event_rsvps',
    'jobs',
    'job_skills',
    'job_applications',
    'job_bookmarks',
    'listings',
    'listing_images',
    'listing_likes',
    'listing_bookmarks',
    'polls',
    'poll_options',
    'poll_votes',
    'study_groups',
    'group_members',
    'group_discussions',
    'group_replies',
    'connections',
    'notifications',
    'feedback',
  ];
  for (const name of required) {
    assert.ok(tableNames.includes(name), `schema.sql is missing table ${name}`);
  }
});

test('no table is declared twice', () => {
  assert.equal(new Set(tableNames).size, tableNames.length);
});

test('every table uses InnoDB, so foreign keys are actually enforced', () => {
  const engines = [...sql.matchAll(/ENGINE=(\w+)/g)].map((m) => m[1]);
  assert.equal(engines.length, tableNames.length);
  assert.ok(engines.every((e) => e === 'InnoDB'));
});

test('every table uses utf8mb4', () => {
  const charsets = [...sql.matchAll(/DEFAULT CHARSET=(\w+)/g)].map((m) => m[1]);
  assert.equal(charsets.length, tableNames.length);
  assert.ok(charsets.every((c) => c === 'utf8mb4'));
});

test('every child table carries a foreign key with an explicit delete rule', () => {
  const declarations = [
    ...sql.matchAll(/FOREIGN KEY[\s\S]*?REFERENCES\s+\w+\s*\([^)]*\)\s*(ON DELETE (?:CASCADE|SET NULL))/g),
  ];
  const total = (sql.match(/FOREIGN KEY/g) ?? []).length;
  assert.ok(total >= 40, `expected at least 40 foreign keys, found ${total}`);
  // Every one of them states its delete rule rather than relying on the default.
  assert.equal(declarations.length, total, 'a foreign key is missing an ON DELETE rule');
});

test('money is DECIMAL, never FLOAT or DOUBLE', () => {
  assert.ok(/price\s+DECIMAL\(10,2\)/.test(sql));
  assert.ok(/stipend_min\s+DECIMAL\(12,2\)/.test(sql));
  assert.ok(!/\b(FLOAT|DOUBLE)\b/.test(sql), 'a floating point column would lose money to rounding');
});

test('rules that must hold regardless of application code are CHECK constraints', () => {
  const checks = [...sql.matchAll(/CONSTRAINT (\w+) CHECK/g)].map((m) => m[1]);
  for (const name of [
    'connections_not_self_chk',
    'listings_price_chk',
    'events_end_after_start_chk',
    'jobs_stipend_range_chk',
    'jobs_openings_chk',
  ]) {
    assert.ok(checks.includes(name), `missing CHECK constraint ${name}`);
  }
});

test('one-per-person rules are unique keys or composite primary keys', () => {
  assert.ok(/UNIQUE KEY users_email_unique \(email\)/.test(sql));
  assert.ok(/UNIQUE KEY job_applications_unique \(job_id, applicant_id\)/.test(sql));
  assert.ok(/UNIQUE KEY blogs_slug_unique \(slug\)/.test(sql));
  // A composite primary key is what stops a second like or a second RSVP.
  assert.ok(/PRIMARY KEY \(user_id, post_id\)/.test(sql));
  assert.ok(/PRIMARY KEY \(event_id, user_id\)/.test(sql));
  assert.ok(/PRIMARY KEY \(poll_id, user_id\)/.test(sql));
  assert.ok(/PRIMARY KEY \(group_id, user_id\)/.test(sql));
});

test('the Drizzle schema exports a table object for each SQL table', () => {
  const exported = Object.entries(schema)
    .filter(([, v]) => v && typeof v === 'object' && Symbol.for('drizzle:Name') in v)
    .map(([, v]) => v[Symbol.for('drizzle:Name')]);
  for (const name of tableNames) {
    assert.ok(exported.includes(name), `Drizzle schema has no table for ${name}`);
  }
});

test('enum vocabularies are shared with the application, not retyped', () => {
  for (const [key, values] of [
    ['NOTICE_CATEGORIES', schema.NOTICE_CATEGORIES],
    ['ROLES', schema.ROLES],
    ['JOB_TYPES', schema.JOB_TYPES],
    ['LISTING_STATUSES', schema.LISTING_STATUSES],
  ]) {
    assert.ok(Array.isArray(values) && values.length > 0, `${key} should be a non-empty list`);
    for (const value of values) {
      assert.ok(sql.includes(`'${value}'`), `schema.sql does not allow ${key} value ${value}`);
    }
  }
});

test('the notification actor survives account deletion', () => {
  // History should not vanish when someone leaves, so this FK nulls rather than cascades.
  assert.ok(/notifications_actor_fk\s+FOREIGN KEY \(actor_id\)\s+REFERENCES users \(id\) ON DELETE SET NULL/.test(sql));
});

test('password hashes are never part of a summary projection', async () => {
  const mapper = await import('../dist/modules/users/user.mapper.js');
  const summary = mapper.toUserSummary({ id: 1, name: 'A', passwordHash: 'secret' });
  assert.ok(!('passwordHash' in summary));
  const publicUser = mapper.toPublicUser({ id: 1, name: 'A', passwordHash: 'secret' });
  assert.ok(!('passwordHash' in publicUser));
});
