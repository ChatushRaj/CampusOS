import { eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { MySqlTable } from 'drizzle-orm/mysql-core';
import { db } from './index.js';
import { blogTags, postTags, tags } from './schema.js';

/** `SELECT COUNT(*)` as a plain number, which is what pagination needs. */
export async function countRows(table: MySqlTable, where?: SQL): Promise<number> {
  const query = db.select({ value: sql<number>`count(*)` }).from(table);
  const [row] = where ? await query.where(where) : await query;
  return Number(row?.value ?? 0);
}

/** True when at least one row matches, without pulling the row back. */
export async function rowExists(table: MySqlTable, where: SQL): Promise<boolean> {
  const [row] = await db
    .select({ value: sql<number>`1` })
    .from(table)
    .where(where)
    .limit(1);
  return Boolean(row);
}

/** MySQL DECIMAL comes back as a string; the API contract expects a number. */
export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(n) ? n : null;
}

/**
 * Resolves tag names to ids, inserting any that are new.
 * `ON DUPLICATE KEY UPDATE` makes this safe when two requests race.
 */
export async function resolveTagIds(names: string[]): Promise<number[]> {
  const unique = [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))];
  if (unique.length === 0) return [];

  await db
    .insert(tags)
    .values(unique.map((name) => ({ name })))
    .onDuplicateKeyUpdate({ set: { name: sql`name` } });

  const rows = await db.select({ id: tags.id, name: tags.name }).from(tags).where(inArray(tags.name, unique));
  return rows.map((r) => r.id);
}

/** Replaces the tag set attached to one post or article. */
export async function setTags(kind: 'post' | 'blog', ownerId: number, names: string[]): Promise<void> {
  const table = kind === 'post' ? postTags : blogTags;
  const ownerColumn = kind === 'post' ? postTags.postId : blogTags.blogId;

  await db.delete(table).where(eq(ownerColumn, ownerId));
  const tagIds = await resolveTagIds(names);
  if (tagIds.length === 0) return;

  const rows =
    kind === 'post'
      ? tagIds.map((tagId) => ({ postId: ownerId, tagId }))
      : tagIds.map((tagId) => ({ blogId: ownerId, tagId }));
  await db.insert(table as never).values(rows as never);
}

/** Loads tag names for a batch of owners in one query, keyed by owner id. */
export async function tagsForOwners(kind: 'post' | 'blog', ownerIds: number[]): Promise<Map<number, string[]>> {
  const grouped = new Map<number, string[]>();
  if (ownerIds.length === 0) return grouped;

  const rows =
    kind === 'post'
      ? await db
          .select({ ownerId: postTags.postId, name: tags.name })
          .from(postTags)
          .innerJoin(tags, eq(postTags.tagId, tags.id))
          .where(inArray(postTags.postId, ownerIds))
      : await db
          .select({ ownerId: blogTags.blogId, name: tags.name })
          .from(blogTags)
          .innerJoin(tags, eq(blogTags.tagId, tags.id))
          .where(inArray(blogTags.blogId, ownerIds));

  for (const row of rows) {
    const list = grouped.get(row.ownerId) ?? [];
    list.push(row.name);
    grouped.set(row.ownerId, list);
  }
  return grouped;
}
