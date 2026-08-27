import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Forwards rejected promises to the error middleware so no route can hang. */
export const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
