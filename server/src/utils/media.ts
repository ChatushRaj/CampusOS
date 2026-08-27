import { env } from '../config/env.js';

/** Turns a stored relative path into an absolute, client-usable URL. */
export function mediaUrl(relativePath?: string | null): string | null {
  if (!relativePath) return null;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  return `${env.PUBLIC_URL.replace(/\/$/, '')}/${relativePath.replace(/^\/+/, '')}`;
}

export function mediaUrls(paths: string[] = []): string[] {
  return paths.map((p) => mediaUrl(p)).filter((p): p is string => Boolean(p));
}
