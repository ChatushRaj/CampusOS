import rateLimit from 'express-rate-limit';

const json = (message: string) => ({ error: { code: 'rate_limited', message } });

/** Broad ceiling for the whole API. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many requests. Try again in a few minutes.'),
});

/** Tight ceiling on credential endpoints to blunt password spraying. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many sign-in attempts. Try again in 15 minutes.'),
});

/** Keeps a single account from flooding the campus feed. */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('You are posting too quickly. Wait a moment and try again.'),
});
