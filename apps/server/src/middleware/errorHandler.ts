// ============================================================
// TELECAL — GLOBAL ERROR HANDLER
// Last middleware in the chain. Catches all unhandled errors.
//
// SECURITY: Never leaks stack traces or internal details
// to the client in production. All raw errors are logged
// server-side; clients only see a safe, generic message.
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { isAppError } from '../utils/errors';
import { sendError, sendServerError } from '../utils/response';
import { logger } from '../lib/logger';
import { isProd } from '../config';

export const globalErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  // ── Zod validation errors ─────────────────────────────────
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request data', details);
    return;
  }

  // ── Known operational errors ──────────────────────────────
  if (isAppError(err) && err.isOperational) {
    logger.warn('Operational error', {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // ── Prisma errors (duck-typed to avoid import issues pre-generate) ──
  const errAsAny = err as Record<string, unknown>;
  if (errAsAny?.constructor?.name === 'PrismaClientKnownRequestError') {
    logger.error('Prisma known error', { code: errAsAny['code'], path: req.path });
    if (errAsAny['code'] === 'P2002') {
      sendError(res, 409, 'CONFLICT', 'A record with this value already exists');
      return;
    }
    if (errAsAny['code'] === 'P2025') {
      sendError(res, 404, 'NOT_FOUND', 'Record not found');
      return;
    }
    sendServerError(res);
    return;
  }

  if (errAsAny?.constructor?.name === 'PrismaClientValidationError') {
    logger.error('Prisma validation error', { message: errAsAny['message'] });
    sendServerError(res);
    return;
  }

  // ── Unknown / programming errors ──────────────────────────
  // Log at error level with full stack — these need investigation
  logger.error('Unhandled error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as Request & { user?: { id: string } }).user?.id,
  });

  // SECURITY: In production, never reveal internal error details
  if (isProd) {
    sendServerError(res);
  } else {
    // In development, show the full error for easier debugging
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
      },
    });
  }
};

// ─── Unhandled promise rejection / exception guard ────────────
// These are registered in index.ts — listed here for reference

export const handleUncaughtException = (err: Error): void => {
  logger.error('UNCAUGHT EXCEPTION — shutting down', {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
};

export const handleUnhandledRejection = (reason: unknown): void => {
  logger.error('UNHANDLED REJECTION — shutting down', { reason });
  process.exit(1);
};
