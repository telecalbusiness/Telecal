// ============================================================
// TELECAL — LOGGER
// Structured logging via Winston.
// Every log entry includes timestamp, level, and context.
// In production, logs rotate daily and are retained 30 days.
// ============================================================

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { config, isProd } from '../config';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

// ─── Console format (development) ────────────────────────────

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr =
      Object.keys(meta).length > 0 ? `\n  ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}] ${message}${stack ? `\n${stack}` : ''}${metaStr}`;
  }),
);

// ─── JSON format (production) ─────────────────────────────────

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

// ─── Transports ───────────────────────────────────────────────

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isProd ? prodFormat : devFormat,
  }),
];

if (isProd) {
  const logDir = config.LOG_DIR;

  // Error log — errors only, retained longer
  transports.push(
    new DailyRotateFile({
      dirname: path.join(logDir, 'error'),
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      level: 'error',
      format: prodFormat,
    }),
  );

  // Combined log — all levels
  transports.push(
    new DailyRotateFile({
      dirname: path.join(logDir, 'combined'),
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      format: prodFormat,
    }),
  );

  // Audit log — separate file, longer retention (7 years for medical compliance)
  transports.push(
    new DailyRotateFile({
      dirname: path.join(logDir, 'audit'),
      filename: 'audit-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '2555d',
      format: prodFormat,
    }),
  );
}

// ─── Logger instance ──────────────────────────────────────────

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  transports,
  // Never crash the server on a logging error
  exitOnError: false,
});

// ─── Child loggers for modules ────────────────────────────────
// Usage: const log = logger.child({ module: 'auth' });

export const createModuleLogger = (moduleName: string) =>
  logger.child({ module: moduleName });

// ─── HTTP request logger stream (for Morgan) ─────────────────

export const httpLogStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};
