import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const ALLOWED = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

/**
 * Files are written with a generated name and an extension derived from the
 * declared MIME type — never from the client-supplied filename, which is the
 * usual path-traversal and double-extension vector.
 */
function createStorage(folder: string) {
  const dir = path.join(process.cwd(), env.UPLOAD_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const ext = ALLOWED.get(file.mimetype) ?? '.bin';
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  });
}

export function imageUpload(folder: string) {
  return multer({
    storage: createStorage(folder),
    limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 4 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED.has(file.mimetype)) {
        cb(ApiError.badRequest('Upload a JPG, PNG, WebP or GIF image.'));
        return;
      }
      cb(null, true);
    },
  });
}

/** Relative path stored in the database, e.g. `uploads/posts/1699-ab12.jpg`. */
export function relativePath(file: Express.Multer.File): string {
  return path.posix.join(env.UPLOAD_DIR, path.basename(path.dirname(file.path)), path.basename(file.path));
}

export function relativePaths(files: Express.Multer.File[] = []): string[] {
  return files.map(relativePath);
}

/** Best-effort cleanup; a missing file must not fail the request. */
export function removeFile(relative?: string | null): void {
  if (!relative) return;
  const resolved = path.resolve(process.cwd(), relative);
  const root = path.resolve(process.cwd(), env.UPLOAD_DIR);
  if (!resolved.startsWith(root)) return; // Refuse to unlink outside the upload root.
  fs.promises.unlink(resolved).catch(() => undefined);
}
