// ============================================================
// TELECAL — EXPRESS APPLICATION
// Security middleware is applied in the correct order.
// Order matters: helmet before cors before body parsers
// before rate limiting before routes before error handler.
// ============================================================

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import hpp from 'hpp';

import { config, isProd } from './config';
import { logger, httpLogStream } from './lib/logger';
import { generalRateLimit } from './middleware/rateLimiter';
import { attachCorrelationId } from './middleware/auth';
import { globalErrorHandler } from './middleware/errorHandler';
import { sendNotFound } from './utils/response';

// ─── Route imports ────────────────────────────────────────────
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { patientsRouter } from './modules/patients/patients.routes';
import { doctorsRouter } from './modules/doctors/doctors.routes';
import { appointmentsRouter } from './modules/appointments/appointments.routes';
import { investigationsRouter } from './modules/investigations/investigations.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { sessionsRouter } from './modules/sessions/sessions.routes';
import { prescriptionsRouter } from './modules/prescriptions/prescriptions.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { walletRouter } from './modules/wallet/wallet.routes';
import { earningsRouter } from './modules/earnings/earnings.routes';
import { payoutsRouter } from './modules/payouts/payouts.routes';

export const createApp = () => {
  const app = express();

  // ── 1. Trust proxy (required for correct IP behind load balancer) ──
  if (isProd) {
    app.set('trust proxy', 1);
  }

  // ── 2. Correlation ID — attach before anything logs ───────────
  app.use(attachCorrelationId);

  // ── 3. Security headers via Helmet ────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          mediaSrc: ["'self'", 'blob:'],   // For video call streams
          connectSrc: ["'self'", 'wss:'],   // Allow WebSocket
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,    // Required for WebRTC
      hsts: isProd
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    }),
  );

  // ── 4. CORS ───────────────────────────────────────────────────
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman in dev)
        if (!origin && !isProd) return callback(null, true);

        const allowed = [config.CLIENT_URL];
        if (allowed.includes(origin ?? '')) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: Origin ${origin} not allowed`));
        }
      },
      credentials: true, // Required for httpOnly cookie auth
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Correlation-ID',
        'X-Requested-With',
      ],
      exposedHeaders: ['X-Correlation-ID'],
    }),
  );

  // ── 5. HTTP request logging ───────────────────────────────────
  app.use(
    morgan(isProd ? 'combined' : 'dev', { stream: httpLogStream }),
  );

  // ── 6. Body parsers ───────────────────────────────────────────
  // Raw body for Paystack webhook signature verification
  app.use(
    '/api/v1/payments/webhook',
    express.raw({ type: 'application/json' }),
  );

  // JSON body parser for all other routes
  app.use(express.json({ limit: '10kb' })); // Limit body size
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // ── 7. Cookie parser ──────────────────────────────────────────
  app.use(cookieParser());

  // ── 8. HTTP Parameter Pollution protection ────────────────────
  app.use(hpp());

  // ── 9. Compression ────────────────────────────────────────────
  app.use(compression());

  // ── 10. General rate limit (all routes) ───────────────────────
  app.use(generalRateLimit);

  // ── 11. Health check (no auth, no rate limit logging) ─────────
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
    });
  });

  // ── 12. API Routes ────────────────────────────────────────────
  const apiPrefix = `/api/${config.API_VERSION}`;

  app.use(`${apiPrefix}/auth`, authRouter);
  app.use(`${apiPrefix}/users`, usersRouter);
  app.use(`${apiPrefix}/patients`, patientsRouter);
  app.use(`${apiPrefix}/doctors`, doctorsRouter);
  app.use(`${apiPrefix}/appointments`, appointmentsRouter);
  app.use(`${apiPrefix}/investigations`, investigationsRouter);
  app.use(`${apiPrefix}/payments`, paymentsRouter);
  app.use(`${apiPrefix}/sessions`, sessionsRouter);
  app.use(`${apiPrefix}/prescriptions`, prescriptionsRouter);
  app.use(`${apiPrefix}/notifications`, notificationsRouter);
  app.use(`${apiPrefix}/admin`, adminRouter);
  app.use(`${apiPrefix}/wallet`, walletRouter);
  app.use(`${apiPrefix}/earnings`, earningsRouter);
  app.use(`${apiPrefix}/payouts`, payoutsRouter);

  // ── 13. 404 handler ───────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    sendNotFound(res, 'Route not found');
  });

  // ── 14. Global error handler (must be last) ───────────────────
  app.use(
    (err: unknown, req: Request, res: Response, next: NextFunction) => {
      globalErrorHandler(err, req, res, next);
    },
  );

  logger.info('Express app configured', {
    environment: config.NODE_ENV,
    apiPrefix,
  });

  return app;
};
