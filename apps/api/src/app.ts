import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { errorHandler, notFoundHandler } from './middleware/error';
import { checkOrigin } from './middleware/origin';
import { authRouter } from './modules/auth';
import { publicRouter } from './modules/public';
import { billingRouter } from './modules/billing';
import { workspaceRouter } from './modules/workspace';
import { integrationCallbacksRouter } from './modules/workspace/integrations';
import { adminRouter } from './modules/admin';
import { developerApiRouter } from './modules/developer-api';
import { telephonyWebhooksRouter } from './telephony/routes';

export function createApp() {
  const app = express();

  // Behind nginx: trust one proxy hop so req.ip and rate limits see the client address.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The API only serves JSON and XML; the strictest CSP costs nothing here.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    }),
  );
  app.use(
    compression({
      // Server-Sent Events must not be buffered by gzip.
      filter: (req, res) => !req.path.endsWith('/assistant') && compression.filter(req, res),
    }),
  );
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(checkOrigin);

  app.get('/api/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, time: new Date().toISOString() });
  });

  // Local uploads. In production nginx serves /uploads directly from disk and
  // never reaches this; it keeps development and nginx-less installs working.
  if (env.STORAGE_DRIVER === 'local') {
    app.use(
      '/uploads',
      express.static(path.resolve(process.cwd(), env.STORAGE_LOCAL_PATH), {
        immutable: true,
        maxAge: '365d',
        index: false,
        dotfiles: 'deny',
      }),
    );
  }

  // Mounted before the JSON parser: the Stripe webhook needs the raw body.
  app.use('/api/billing', billingRouter);

  app.use(express.json({ limit: '6mb' }));
  // Carrier webhooks post form-encoded bodies.
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  app.use('/api/auth', authRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/app', workspaceRouter);
  app.use('/api/integrations', integrationCallbacksRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/telephony', telephonyWebhooksRouter);
  app.use('/api/v1', developerApiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
