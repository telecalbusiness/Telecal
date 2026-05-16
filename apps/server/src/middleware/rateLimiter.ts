// ============================================================
// TELECAL — RATE LIMITING
// Different limits for different endpoint sensitivity levels.
//
// Auth endpoints: strict (brute force prevention)
// Payment webhooks: very strict (fraud prevention)
// General API: standard
// ============================================================

import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { sendTooManyRequests } from '../utils/response';
import { Request, Response } from 'express';

const rateLimitHandler = (_req: Request, res: Response) => {
  sendTooManyRequests(res, 'Too many requests. Please try again later.');
};

// ─── General API rate limit ───────────────────────────────────
// 100 requests per 15 minutes per IP

export const generalRateLimit = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
  // Store: use Redis in production for distributed rate limiting
  // For now, in-memory store works for single-instance deployment
  skip: (req) => req.ip === '127.0.0.1' && config.NODE_ENV === 'test',
});

// ─── Auth rate limit ──────────────────────────────────────────
// 10 attempts per 15 minutes per IP — brute force protection

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    sendTooManyRequests(
      res,
      'Too many authentication attempts. Please try again in 15 minutes.',
    );
  },
  skip: (req) => req.ip === '127.0.0.1' && config.NODE_ENV === 'test',
});

// ─── Payment webhook rate limit ───────────────────────────────
// Very strict — only Paystack servers should hit this

export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // 60 per minute — Paystack can send bursts
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// ─── File upload rate limit ───────────────────────────────────
// Prevent storage abuse

export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,                   // 20 uploads per hour per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    sendTooManyRequests(res, 'Upload limit reached. Please try again in an hour.');
  },
});

// ─── Password reset rate limit ────────────────────────────────

export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,                    // 3 reset attempts per hour
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    sendTooManyRequests(
      res,
      'Too many password reset attempts. Please try again in an hour.',
    );
  },
});
