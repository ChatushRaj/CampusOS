import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.isProd ? 'info' : 'debug',
  // Never let credentials or tokens reach the log sink.
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password', '*.password'],
    censor: '[redacted]',
  },
  transport: env.isProd ? undefined : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});
