import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  // e.g. mysql://campusos:password@127.0.0.1:3306/campusos
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_POOL_SIZE: z.coerce.number().int().positive().max(100).default(10),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(24, 'JWT_ACCESS_SECRET must be at least 24 characters'),
  JWT_REFRESH_SECRET: z.string().min(24, 'JWT_REFRESH_SECRET must be at least 24 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  STAFF_INVITE_CODE: z.string().min(6, 'STAFF_INVITE_CODE must be at least 6 characters'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
  PUBLIC_URL: z.string().url().default('http://localhost:4000'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // Fail fast: a half-configured server is worse than one that refuses to boot.
  throw new Error(
    `Invalid environment configuration.\n${details}\n\nCopy .env.example to .env and fill in the values.`,
  );
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  corsOrigins: parsed.data.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};
