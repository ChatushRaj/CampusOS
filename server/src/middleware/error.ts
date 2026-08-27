import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
};

/**
 * MySQL reports constraint violations as numeric error codes. Translating the
 * ones a user can actually trigger turns a 500 into a message they can act on —
 * a unique index is a race-condition-proof duplicate check, so this path runs
 * even when the controller checked first.
 */
interface DriverError {
  errno?: number;
  code?: string;
  sqlMessage?: string;
}

function fromDriver(err: DriverError): { status: number; code: string; message: string } | null {
  switch (err.errno) {
    case 1062: {
      // ER_DUP_ENTRY — the index name tells us which rule was broken.
      const index = /for key '(?:[\w.]+\.)?(\w+)'/.exec(err.sqlMessage ?? '')?.[1] ?? '';
      const messages: Record<string, string> = {
        users_email_unique: 'An account already uses that email address.',
        users_roll_number_unique: 'That roll number is already registered.',
        job_applications_unique: 'You have already applied to this role.',
        blogs_slug_unique: 'An article with that title already exists.',
      };
      return { status: 409, code: 'conflict', message: messages[index] ?? 'That record already exists.' };
    }
    case 1452:
      // ER_NO_REFERENCED_ROW — pointing at something that has since been deleted.
      return { status: 400, code: 'invalid_reference', message: 'That item no longer exists.' };
    case 1451:
      // ER_ROW_IS_REFERENCED — should not surface, since deletes cascade.
      return { status: 409, code: 'conflict', message: 'Something still depends on that item.' };
    case 4025:
    case 3819:
      // CHECK constraint failed — a value the database refuses to store.
      return { status: 400, code: 'validation_error', message: 'One of those values is not allowed.' };
    case 1406:
      return { status: 400, code: 'validation_error', message: 'One of those values is too long.' };
    case 1265:
      return { status: 400, code: 'validation_error', message: 'One of those values is not a permitted option.' };
    default:
      return null;
  }
}

/** Translates every thrown value into a consistent, non-leaky JSON envelope. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let message = 'Something went wrong on our side. Please try again.';
  let code = 'internal_error';
  let details: unknown;

  if (err instanceof ApiError) {
    ({ status, message, code, details } = err);
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = 'upload_error';
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `Files must be smaller than ${env.MAX_UPLOAD_MB} MB.`
        : 'That upload could not be processed.';
  } else {
    const driver = typeof err === 'object' && err !== null ? fromDriver(err as DriverError) : null;
    if (driver) ({ status, code, message } = driver);
  }

  if (status >= 500) {
    logger.error({ err }, 'Unhandled error');
  } else {
    logger.debug({ err: (err as Error).message, status }, 'Request rejected');
  }

  // Stack traces and SQL text stay on the server; the client gets a message it can display.
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
};
