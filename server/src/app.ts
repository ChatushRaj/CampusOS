import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { ApiError } from './utils/ApiError.js';

import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import postRoutes from './modules/posts/post.routes.js';
import blogRoutes from './modules/blogs/blog.routes.js';
import noticeRoutes from './modules/notices/notice.module.js';
import eventRoutes from './modules/events/event.module.js';
import jobRoutes from './modules/jobs/job.module.js';
import listingRoutes from './modules/listings/listing.module.js';
import pollRoutes from './modules/polls/poll.module.js';
import connectionRoutes from './modules/connections/connection.module.js';
import notificationRoutes from './modules/notifications/notification.module.js';
import bookmarkRoutes from './modules/bookmarks/bookmark.module.js';
import groupRoutes from './modules/groups/group.module.js';
import searchRoutes from './modules/search/search.module.js';
import dashboardRoutes from './modules/dashboard/dashboard.module.js';
import feedbackRoutes from './modules/feedback/feedback.module.js';

export function createApp() {
  const app = express();

  // Behind a proxy (Render, Fly, nginx) so rate limiting sees the real client IP.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Uploaded images are served from this origin and embedded by the web client.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin and server-to-server calls arrive without an Origin header.
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        callback(ApiError.forbidden('This origin is not allowed to call the API.'));
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

  app.use(
    `/${env.UPLOAD_DIR}`,
    express.static(path.join(process.cwd(), env.UPLOAD_DIR), {
      maxAge: '7d',
      immutable: true,
      // Uploads are user data: never let the browser run one as a script.
      setHeaders: (res) => res.setHeader('Content-Disposition', 'inline'),
    }),
  );

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/blogs', blogRoutes);
  app.use('/api/notices', noticeRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/marketplace', listingRoutes);
  app.use('/api/polls', pollRoutes);
  app.use('/api/connections', connectionRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/bookmarks', bookmarkRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/feedback', feedbackRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
