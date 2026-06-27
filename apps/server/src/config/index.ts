// ============================================================
// TELECAL — SERVER CONFIG
// Validates ALL environment variables at startup.
// The server will refuse to start if any required variable
// is missing or malformed. No silent misconfigurations.
// ============================================================

import { z } from 'zod';

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z.string().url(),
  API_VERSION: z.string().default('v1'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Auth
  JWT_ACCESS_SECRET: z
    .string()
    .min(64, 'JWT_ACCESS_SECRET must be at least 64 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(64, 'JWT_REFRESH_SECRET must be at least 64 characters'),

  // Encryption
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)'),

  // Storage
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_S3_ENDPOINT: z.string().optional(),
  AWS_S3_BUCKET_REGION: z.string().optional(),
  LOCAL_STORAGE_PATH: z.string().default('./uploads'),

  // Email
  EMAIL_PROVIDER: z.enum(['smtp', 'resend']).default('smtp'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM_NAME: z.string().default('MediConnect'),
  EMAIL_FROM_ADDRESS: z.string().email().default('no-reply@mediconnect.com'),

  // Paystack
  PAYSTACK_SECRET_KEY: z.string().min(1, 'PAYSTACK_SECRET_KEY is required'),
  PAYSTACK_PUBLIC_KEY: z.string().min(1, 'PAYSTACK_PUBLIC_KEY is required'),
  PAYSTACK_WEBHOOK_SECRET: z
    .string()
    .min(1, 'PAYSTACK_WEBHOOK_SECRET is required'),

  // WebRTC
  TURN_SERVER_URL: z.string().optional(),
  TURN_SERVER_USERNAME: z.string().optional(),
  TURN_SERVER_CREDENTIAL: z.string().optional(),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_DIR: z.string().default('./logs'),
});

// Parse and validate at module load time.
// If anything is wrong, throw immediately with a clear error message.
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('\n❌ FATAL: Invalid environment configuration:\n');
  parseResult.error.issues.forEach((issue) => {
    console.error(`  • ${issue.path.join('.')}: ${issue.message}`);
  });
  console.error(
    '\n  Copy .env.example to .env and fill in all required values.\n',
  );
  process.exit(1);
}

export const config = parseResult.data;

export const isProd = config.NODE_ENV === 'production';
export const isDev = config.NODE_ENV === 'development';
export const isTest = config.NODE_ENV === 'test';
