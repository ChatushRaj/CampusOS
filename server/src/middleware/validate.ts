import type { RequestHandler } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError.js';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validates and *replaces* the request parts with their parsed output, so handlers
 * receive typed, stripped data rather than whatever the client sent.
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) {
        // `req.query` is a getter in newer Express, so it is redefined rather than assigned.
        // `configurable` must stay true or a second validate() on the same request would throw.
        Object.defineProperty(req, 'query', {
          value: schemas.query.parse(req.query),
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of err.issues) {
          const key = issue.path.join('.') || 'form';
          if (!fields[key]) fields[key] = issue.message;
        }
        const first = err.issues[0]?.message ?? 'Check the highlighted fields.';
        return next(ApiError.badRequest(first, fields));
      }
      next(err);
    }
  };
