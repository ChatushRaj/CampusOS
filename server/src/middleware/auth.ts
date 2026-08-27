import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/tokens.js';
import type { Role } from '../db/schema.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: number; role: Role };
    }
  }
}

function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/** Rejects the request unless a valid access token is present. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = readToken(req);
  if (!token) return next(ApiError.unauthorized());
  const payload = verifyAccessToken(token);
  req.user = { id: Number(payload.sub), role: payload.role };
  next();
};

/** Attaches the user when a token is present but never rejects — used by public reads. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = readToken(req);
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: Number(payload.sub), role: payload.role };
    } catch {
      // An expired token on a public route is not an error; treat the caller as anonymous.
    }
  }
  next();
};

/** Restricts a route to the listed roles. Must run after `requireAuth`. */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Your role does not allow this action.'));
    }
    next();
  };

export const requireStaff = requireRole('faculty', 'admin');
export const requireAdmin = requireRole('admin');
