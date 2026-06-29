// ============================================================
// TELECAL — PAYMENTS SERVICE
//
// Payment flow:
//  1. Client calls POST /payments/initialize
//     → Creates/updates payment record, returns Paystack URL
//  2. Patient pays on Paystack-hosted page
//  3. Paystack fires webhook to POST /payments/webhook
//  4. We verify signature + amount, update payment status
//  5. If CONSULTATION payment: trigger assignment engine
//  6. If INVESTIGATION payment: unlock report upload
// ============================================================

import { FEES } from '@mediconnect/shared';
import { config } from '../../config';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import {
  initializeTransaction,
  verifyTransaction,
  validatePaymentAmount,
} from '../../lib/paystack';
import { encrypt } from '../../utils/encryption';
import { NotFoundError, AppError } from '../../utils/errors';
import { assignmentEngine } from '../../lib/queue/assignmentEngine';
import { auditService } from '../audit/audit.service';
import { emailService } from '../../lib/email';
import { notificationService } from '../notifications/notifications.service';

// ─── Initialize payment for an appointment ────────────────────

export const initializeAppointmentPayment = async (
  appointmentId: string,
  patientUserId: string,
) => {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, deletedAt: null },
    include: {
      patient: {
        include: { user: { select: { email: true, firstName: true } } },
      },
      payment: true,
    },
  });

  if (!appointment) throw new NotFoundError('Appointment');
  if (appointment.patient.userId !== patientUserId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }
  if (!appointment.payment) {
    throw new AppError(400, 'BAD_REQUEST', 'No payment record found for this appointment');
  }
  if (appointment.payment.status === 'SUCCESSFUL') {
    throw new AppError(409, 'CONFLICT', 'This appointment has already been paid for');
  }

  const paystackData = await initializeTransaction({
    email: appointment.patient.user.email,
    amountKobo: appointment.payment.amountKobo,
    reference: appointment.payment.paystackReference,
    callbackUrl: `${config.CLIENT_URL}/payment/success?reference=${appointment.payment.paystackReference}`,
    metadata: {
      appointmentId: appointment.id,
      purpose: 'CONSULTATION',
      patientFileNumber: appointment.patient.fileNumber,
    },
  });

  logger.info('Payment initialized', {
    appointmentId,
    reference: appointment.payment.paystackReference,
  });

  return {
    authorizationUrl: paystackData.data.authorization_url,
    reference: paystackData.data.reference,
    amountKobo: appointment.payment.amountKobo,
  };
};

// ─── Initialize payment for an investigation ──────────────────

export const initializeInvestigationPayment = async (
  investigationId: string,
  patientUserId: string,
) => {
  const investigation = await prisma.investigation.findFirst({
    where: { id: investigationId },
    include: {
      patient: {
        include: { user: { select: { email: true } } },
      },
      payment: true,
    },
  });

  if (!investigation) throw new NotFoundError('Investigation');
  if (investigation.patient.userId !== patientUserId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }
  if (investigation.payment?.status === 'SUCCESSFUL') {
    throw new AppError(409, 'CONFLICT', 'Investigation already paid for');
  }

  const amountKobo = investigation.isReturningPatient
    ? FEES.INVESTIGATION_RETURNING_KOBO
    : FEES.INVESTIGATION_NEW_KOBO;

  const reference = `MC-INV-${investigationId.slice(0, 8).toUpperCase()}-${Date.now()}`;

  // Create payment record if it doesn't exist
  if (!investigation.payment) {
    await prisma.payment.create({
      data: {
        patientId: investigation.patientId,
        purpose: investigation.isReturningPatient
          ? 'INVESTIGATION_RETURNING'
          : 'INVESTIGATION_NEW',
        paystackReference: reference,
        amountKobo,
        currency: 'NGN',
        status: 'PENDING',
        investigationId: investigation.id,
      },
    });
  }

  const paystackData = await initializeTransaction({
    email: investigation.patient.user.email,
    amountKobo,
    reference: investigation.payment?.paystackReference ?? reference,
    callbackUrl: `${config.CLIENT_URL}/payment/success?reference=${investigation.payment?.paystackReference ?? reference}&type=investigation`,
    metadata: { investigationId, purpose: 'INVESTIGATION' },
  });

  return {
    authorizationUrl: paystackData.data.authorization_url,
    reference: paystackData.data.reference,
    amountKobo,
  };
};

// ─── Webhook handler ──────────────────────────────────────────
//
// This is called ONLY after the signature has been verified
// by the route handler. Never call this directly.

export const handleVerifiedWebhook = async (
  event: string,
  data: Record<string, unknown>,
): Promise<void> => {
  if (event !== 'charge.success') return;

  const reference = data['reference'] as string;
  const paidAmountKobo = data['amount'] as number;

  // Find our payment record
  const payment = await prisma.payment.findUnique({
    where: { paystackReference: reference },
    include: {
      appointment: true,
      investigation: true,
    },
  });

  if (!payment) {
    logger.warn('Webhook received for unknown reference', { reference });
    return;
  }

  // Idempotency check — already processed
  if (payment.status === 'SUCCESSFUL') {
    logger.info('Webhook already processed, skipping', { reference });
    return;
  }

  // Amount validation — reject if less than expected
  if (!validatePaymentAmount(paidAmountKobo, payment.amountKobo)) {
    logger.error('PAYMENT AMOUNT MISMATCH — possible fraud attempt', {
      reference,
      expectedKobo: payment.amountKobo,
      receivedKobo: paidAmountKobo,
    });
    await auditService.log({
      action: 'RECORD_MODIFIED',
      resourceType: 'Payment',
      resourceId: payment.id,
      metadata: { alert: 'AMOUNT_MISMATCH', reference, paidAmountKobo },
    });
    return;
  }

  // Verify with Paystack API (don't just trust the webhook body)
  const verified = await verifyTransaction(reference);
  if (verified.status !== 'success') {
    logger.warn('Webhook received but Paystack API verification failed', { reference });
    return;
  }

  // Encrypt the raw gateway response before storing
  const gatewayResponseEncrypted = encrypt(JSON.stringify(data));

  // Update payment status atomically — including wallet credit if this is a top-up
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESSFUL',
        paidAt: new Date(verified.paid_at),
        gatewayResponseEncrypted,
      },
    });

    // Unlock what the payment was for
    if (payment.appointmentId) {
      await tx.appointment.update({
        where: { id: payment.appointmentId },
        data: { status: 'PAYMENT_CONFIRMED' },
      });
    }

    if (payment.investigationId) {
      await tx.investigation.update({
        where: { id: payment.investigationId },
        data: { status: 'PAYMENT_CONFIRMED' },
      });
    }

    // Credit wallet immediately inside transaction for top-ups
    if (payment.purpose === 'WALLET_TOPUP') {
      const patientProfile = await tx.patientProfile.findUnique({
        where: { id: payment.patientId },
        select: { userId: true },
      });
      if (patientProfile) {
        const wallet = await tx.wallet.findUnique({
          where: { userId: patientProfile.userId },
        });
        if (!wallet) throw new Error('Wallet not found');
        if (wallet.balanceKobo < 0) throw new Error('Invalid wallet state');

        const newBalance = wallet.balanceKobo + paidAmountKobo;
        await tx.wallet.update({
          where: { userId: patientProfile.userId },
          data: { balanceKobo: newBalance },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'TOPUP',
            amountKobo: paidAmountKobo,
            balanceAfter: newBalance,
            description: 'Wallet top-up via Paystack',
            reference,
          },
        });
      }
    }
  });

  logger.info('Payment confirmed', {
    reference,
    purpose: payment.purpose,
    amountKobo: paidAmountKobo,
  });

  // Send payment confirmation email and notification (non-blocking)
  const patient = await prisma.patientProfile.findUnique({
    where: { id: payment.patientId },
    include: { user: { select: { id: true, email: true, firstName: true } } },
  });
  if (patient) {
    void emailService.sendPaymentConfirmed({
      patientEmail: patient.user.email,
      patientFirstName: patient.user.firstName,
      amountNGN: (paidAmountKobo / 100).toFixed(0),
      reference,
      purpose: payment.purpose.replace(/_/g, ' ').toLowerCase(),
    });

    void notificationService.createNotification({
      userId: patient.user.id,
      type: 'PAYMENT_CONFIRMED',
      title: payment.purpose === 'WALLET_TOPUP' ? 'Wallet topped up' : 'Payment confirmed',
      message: payment.purpose === 'WALLET_TOPUP'
        ? `₦${(paidAmountKobo / 100).toLocaleString()} has been added to your wallet.`
        : `Your payment of ₦${(paidAmountKobo / 100).toLocaleString()} has been confirmed. Reference: ${reference}`,
      metadata: { reference, amountKobo: paidAmountKobo },
    });
  }

  // Trigger assignment engine for consultations
  if (payment.appointmentId) {
    await assignmentEngine.processQueue();
  }
};

export const paymentsService = {
  initializeAppointmentPayment,
  initializeInvestigationPayment,
  handleVerifiedWebhook,
};
