// ============================================================
// TELECAL — PAYMENTS ROUTES
//
// SECURITY NOTE:
// The /webhook endpoint receives raw Buffer body (configured
// in app.ts) so we can verify the Paystack HMAC signature
// against the exact bytes received. Any middleware that
// re-parses the body would break signature verification.
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requirePatient } from '../../middleware/auth';
import { webhookRateLimit } from '../../middleware/rateLimiter';
import { paymentsService } from './payments.service';
import { verifyWebhookSignature } from '../../lib/paystack';
import { sendSuccess } from '../../utils/response';
import { logger } from '../../lib/logger';

export const paymentsRouter = Router();

// ── Initialize payment for an appointment ─────────────────────
paymentsRouter.post(
  '/appointments/:id/initialize',
  requireAuth,
  requirePatient,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentsService.initializeAppointmentPayment(
        req.params['id']!,
        req.user!.id,
      );
      sendSuccess(res, data, 'Payment initialized');
    } catch (err) { next(err); }
  },
);

// ── Initialize payment for an investigation ───────────────────
paymentsRouter.post(
  '/investigations/:id/initialize',
  requireAuth,
  requirePatient,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentsService.initializeInvestigationPayment(
        req.params['id']!,
        req.user!.id,
      );
      sendSuccess(res, data, 'Payment initialized');
    } catch (err) { next(err); }
  },
);

// ── Paystack webhook ──────────────────────────────────────────
// IMPORTANT: This route uses raw body (set in app.ts).
// No auth middleware — Paystack calls this directly.
// Security is entirely via HMAC signature verification.
paymentsRouter.post(
  '/webhook',
  webhookRateLimit,
  async (req: Request, res: Response) => {
    // Always respond 200 immediately — Paystack retries on non-200
    // The actual processing happens asynchronously
    res.status(200).json({ received: true });

    try {
      const signature = req.headers['x-paystack-signature'] as string | undefined;

      if (!signature) {
        logger.warn('Webhook received without signature header');
        return;
      }

      const rawBody = req.body as Buffer;

      if (!verifyWebhookSignature(rawBody, signature)) {
        logger.warn('Webhook signature verification FAILED — possible spoofed request', {
          ip: req.ip,
          signature: signature.slice(0, 10) + '...',
        });
        return;
      }

      // Parse only after signature is verified
      const payload = JSON.parse(rawBody.toString()) as {
        event: string;
        data: Record<string, unknown>;
      };

      logger.info('Paystack webhook received and verified', { event: payload.event });

      await paymentsService.handleVerifiedWebhook(payload.event, payload.data);
    } catch (err) {
      // Log but don't re-throw — response already sent
      logger.error('Webhook processing error', { err });
    }
  },
);

