import type { Request } from 'express';

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
}

/** Clamped page parameters — an unbounded `limit` is a denial-of-service vector. */
export function getPageParams(req: Request, defaultLimit = 12, maxLimit = 50): PageParams {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
  const raw = Number.parseInt(String(req.query.limit ?? defaultLimit), 10) || defaultLimit;
  const limit = Math.min(Math.max(1, raw), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export function paginated<T>(items: T[], total: number, { page, limit }: PageParams): Paginated<T> {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { items, page, limit, total, totalPages, hasMore: page < totalPages };
}

/** Escapes user input before it is used inside a RegExp for search. */
/**
 * Escapes the wildcards LIKE treats specially. Query parameters are always bound,
 * so this is not about injection — it is about correctness: without it, someone
 * searching for "100%" or "user_name" gets a wildcard instead of a literal match.
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&');
}

/** Builds a bound LIKE pattern for a "contains" search. */
export function containsPattern(input: string): string {
  return `%${escapeLike(input)}%`;
}
