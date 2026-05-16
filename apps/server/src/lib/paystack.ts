// ============================================================
// TELECAL — PAYSTACK CLIENT
//
// Security rules:
//  1. Secret key NEVER leaves the server
//  2. Every webhook is verified via HMAC-SHA512 signature
//  3. Payment status is ALWAYS confirmed server-side
//     before any action is taken — never trust the frontend
//  4. Amounts are verified against our DB records —
//     a tampered amount in the callback is rejected
// ============================================================

import crypto from 'crypto';
import { config } from '../config';
import { PAYSTACK } from '@mediconnect/shared';
import { logger } from './logger';

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    status: 'success' | 'failed' | 'abandoned';
    reference: string;
    amount: number; // In kobo
    currency: string;
    paid_at: string;
    customer: {
      email: string;
    };
    metadata?: Record<string, unknown>;
  };
}

// ─── Initialize transaction ───────────────────────────────────

export const initializeTransaction = async (params: {
  email: string;
  amountKobo: number;
  reference: string;
  metadata?: Record<string, unknown>;
  callbackUrl?: string;
}): Promise<PaystackInitializeResponse> => {
  const response = await fetch(`${PAYSTACK.BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      currency: PAYSTACK.CURRENCY,
      metadata: params.metadata,
      callback_url: params.callbackUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Paystack initialize failed', { status: response.status, error });
    throw new Error('Payment initialization failed');
  }

  return response.json() as Promise<PaystackInitializeResponse>;
};

// ─── Verify transaction ───────────────────────────────────────

export const verifyTransaction = async (
  reference: string,
): Promise<PaystackVerifyResponse['data']> => {
  const response = await fetch(
    `${PAYSTACK.BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
      },
    },
  );

  if (!response.ok) {
    logger.error('Paystack verify failed', { reference, status: response.status });
    throw new Error('Payment verification failed');
  }

  const data = (await response.json()) as PaystackVerifyResponse;
  return data.data;
};

// ─── Webhook signature verification ──────────────────────────
//
// Paystack signs every webhook with HMAC-SHA512 using your
// secret key. We verify this before processing ANY webhook.
// A failed verification means the request is not from Paystack.

export const verifyWebhookSignature = (
  rawBody: Buffer,
  signatureHeader: string,
): boolean => {
  const hash = crypto
    .createHmac('sha512', config.PAYSTACK_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(signatureHeader, 'hex'),
    );
  } catch {
    return false;
  }
};

// ─── Amount validation ────────────────────────────────────────
//
// After verifying the webhook, confirm the amount paid
// matches what we expect. Rejects tampered amounts.

export const validatePaymentAmount = (
  paidAmountKobo: number,
  expectedAmountKobo: number,
): boolean => {
  return paidAmountKobo >= expectedAmountKobo;
};
