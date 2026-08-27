import mysql from 'mysql2/promise';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import * as schema from './schema.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * A pool, not a single connection: every request borrows and returns one, so a
 * slow query cannot block the whole process.
 */
export const pool = mysql.createPool({
  uri: env.DATABASE_URL,
  connectionLimit: env.DB_POOL_SIZE,
  waitForConnections: true,
  queueLimit: 0,
  // Dates come back as JS Date objects rather than strings.
  dateStrings: false,
  // Guard against a runaway query holding a connection forever.
  connectTimeout: 10_000,
  timezone: 'Z',
  charset: 'utf8mb4_unicode_ci',
  supportBigNumbers: true,
});

export const db: MySql2Database<typeof schema> = drizzle(pool, { schema, mode: 'default' });

export async function connectDatabase(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    logger.info('Database connected');
  } finally {
    connection.release();
  }
}

export async function disconnectDatabase(): Promise<void> {
  await pool.end();
  logger.info('Database pool closed');
}

export * from './schema.js';
