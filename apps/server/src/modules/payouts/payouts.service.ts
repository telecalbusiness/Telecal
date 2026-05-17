// ============================================================
// TELECAL — PAYOUTS SERVICE
//
// Handles admin-triggered payouts to doctors via
// Paystack Transfer API.
//
// Flow:
//  1. Admin specifies doctor + period to pay out
//  2. System checks doctor has a verified bank account
//  3. System checks doctor's wallet balance >= payout amount
//  4. Creates a DoctorPayout record (PENDING)
//  5. Calls Paystack Transfer API
//  6. On success: debits doctor wallet, marks payout COMPLETED
//  7. Notifies doctor
//
// Bank account verification:
//  - Admin or doctor adds bank account
//  - System verifies account number via Paystack
//  - Verified account is stored with paystackRecipientCode
// ============================================================

import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { NotFoundError, AppError } from '../../utils/errors';
import { auditService } from '../audit/audit.service';
import { notificationService } from '../notifications/notifications.service';
import { config } from '../../config';
import { PAYSTACK } from '@mediconnect/shared';

// Cast prisma to any so new models (doctorBankAccount, doctorPayout)
// are accessible before the editor picks up the regenerated Prisma client.
// Fully typed after running: npx prisma generate
const db = prisma as any;

// ─── Paystack Transfer API helpers ───────────────────────────

interface PaystackBankListResponse {
  status: boolean;
  data: Array<{
    name: string;
    code: string;
    active: boolean;
  }>;
}

interface PaystackResolveAccountResponse {
  status: boolean;
  data: {
    account_number: string;
    account_name: string;
  };
}

interface PaystackCreateRecipientResponse {
  status: boolean;
  data: {
    recipient_code: string;
    type: string;
    name: string;
  };
}

interface PaystackTransferResponse {
  status: boolean;
  data: {
    reference: string;
    transfer_code: string;
    status: string;
  };
}

const paystackHeaders = () => ({
  Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json',
});

// ─── Get list of Nigerian banks from Paystack ─────────────────

export const getPaystackBanks = async () => {
  const response = await fetch(`${PAYSTACK.BASE_URL}/bank?currency=NGN&country=nigeria`, {
    headers: paystackHeaders(),
  });

  if (!response.ok) {
    throw new AppError(502, 'EXTERNAL_SERVICE_ERROR', 'Failed to fetch bank list from Paystack');
  }

  const data = (await response.json()) as PaystackBankListResponse;
  return data.data.filter((b) => b.active).map((b) => ({ name: b.name, code: b.code }));
};

// ─── Verify account number with Paystack ─────────────────────

export const verifyBankAccount = async (accountNumber: string, bankCode: string) => {
  const response = await fetch(
    `${PAYSTACK.BASE_URL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
    { headers: paystackHeaders() },
  );

  if (!response.ok) {
    throw new AppError(
      400,
      'INVALID_BANK_ACCOUNT',
      'Could not verify this account number. Please check the details and try again.',
    );
  }

  const data = (await response.json()) as PaystackResolveAccountResponse;
  if (!data.status) {
    throw new AppError(400, 'INVALID_BANK_ACCOUNT', 'Account number could not be verified');
  }

  return {
    accountNumber: data.data.account_number,
    accountName: data.data.account_name,
  };
};

// ─── Create Paystack transfer recipient ───────────────────────

const createTransferRecipient = async (
  accountName: string,
  accountNumber: string,
  bankCode: string,
): Promise<string> => {
  const response = await fetch(`${PAYSTACK.BASE_URL}/transferrecipient`, {
    method: 'POST',
    headers: paystackHeaders(),
    body: JSON.stringify({
      type: 'nuban',
      name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'NGN',
    }),
  });

  if (!response.ok) {
    throw new AppError(502, 'EXTERNAL_SERVICE_ERROR', 'Failed to create transfer recipient');
  }

  const data = (await response.json()) as PaystackCreateRecipientResponse;
  return data.data.recipient_code;
};

// ─── Save doctor bank account ─────────────────────────────────

export const saveDoctorBankAccount = async (
  doctorUserId: string,
  accountNumber: string,
  bankCode: string,
  bankName: string,
) => {
  const doctor = await db.doctorProfile.findUnique({
    where: { userId: doctorUserId },
  });
  if (!doctor) throw new NotFoundError('Doctor profile');

  // Verify account with Paystack
  const verified = await verifyBankAccount(accountNumber, bankCode);

  // Create Paystack transfer recipient
  const recipientCode = await createTransferRecipient(
    verified.accountName,
    verified.accountNumber,
    bankCode,
  );

  // Upsert — doctor can only have one active bank account
  const bankAccount = await db.doctorBankAccount.upsert({
    where: { doctorProfileId: doctor.id },
    create: {
      doctorProfileId: doctor.id,
      bankCode,
      bankName,
      accountNumber: verified.accountNumber,
      accountName: verified.accountName,
      paystackRecipientCode: recipientCode,
      isVerified: true,
    },
    update: {
      bankCode,
      bankName,
      accountNumber: verified.accountNumber,
      accountName: verified.accountName,
      paystackRecipientCode: recipientCode,
      isVerified: true,
    },
  });

  logger.info('Doctor bank account saved', {
    doctorProfileId: doctor.id,
    accountName: verified.accountName,
    bankName,
  });

  return bankAccount;
};

// ─── Get doctor bank account ──────────────────────────────────

export const getDoctorBankAccount = async (doctorUserId: string) => {
  const doctor = await db.doctorProfile.findUnique({
    where: { userId: doctorUserId },
    include: { bankAccount: true },
  });
  if (!doctor) throw new NotFoundError('Doctor profile');

  return doctor.bankAccount;
};

// ─── Admin: initiate payout to a doctor ──────────────────────

export const initiatePayout = async (
  doctorProfileId: string,
  adminUserId: string,
  periodStart: Date,
  periodEnd: Date,
) => {
  // Load doctor with bank account and wallet
  const doctor = await db.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      bankAccount: true,
    },
  });

  if (!doctor) throw new NotFoundError('Doctor profile');

  if (!doctor.bankAccount || !doctor.bankAccount.isVerified) {
    throw new AppError(
      400,
      'NO_BANK_ACCOUNT',
      'This doctor has not set up a verified bank account yet',
    );
  }

  if (!doctor.bankAccount.paystackRecipientCode) {
    throw new AppError(
      400,
      'NO_RECIPIENT_CODE',
      'Bank account is not linked to a Paystack recipient. Please re-save the bank account.',
    );
  }

  // Get doctor's current wallet balance
  const wallet = await prisma.wallet.findUnique({ where: { userId: doctor.user.id } });
  const balanceKobo = wallet?.balanceKobo ?? 0;

  if (balanceKobo <= 0) {
    throw new AppError(400, 'NO_EARNINGS', 'Doctor has no earnings to pay out');
  }

  // Minimum payout of ₦500 (50000 kobo) to avoid tiny transfers
  if (balanceKobo < 50_000) {
    throw new AppError(
      400,
      'BELOW_MINIMUM',
      `Payout amount (₦${(balanceKobo / 100).toFixed(0)}) is below the minimum of ₦500`,
    );
  }

  const payoutReference = `TC-PAYOUT-${doctorProfileId.slice(0, 8).toUpperCase()}-${Date.now()}`;

  // Create payout record as PENDING first
  const payout = await db.doctorPayout.create({
    data: {
      doctorProfileId,
      initiatedBy: adminUserId,
      amountKobo: balanceKobo,
      paystackReference: payoutReference,
      status: 'PROCESSING',
      periodStart,
      periodEnd,
    },
  });

  await auditService.log({
    userId: adminUserId,
    action: 'PAYOUT_INITIATED',
    resourceType: 'DoctorPayout',
    resourceId: payout.id,
    metadata: { doctorProfileId, amountKobo: balanceKobo, payoutReference },
  });

  // Initiate Paystack transfer
  try {
    const transferResponse = await fetch(`${PAYSTACK.BASE_URL}/transfer`, {
      method: 'POST',
      headers: paystackHeaders(),
      body: JSON.stringify({
        source: 'balance',
        amount: balanceKobo,
        reference: payoutReference,
        recipient: doctor.bankAccount.paystackRecipientCode,
        reason: `Telecal earnings payout — ${periodStart.toDateString()} to ${periodEnd.toDateString()}`,
      }),
    });

    if (!transferResponse.ok) {
      const errText = await transferResponse.text();
      logger.error('Paystack transfer failed', { errText, payoutReference });
      throw new Error('Paystack transfer request failed');
    }

    const transferData = (await transferResponse.json()) as PaystackTransferResponse;

    // Debit doctor wallet and mark payout as completed
    await prisma.$transaction(async (tx: any) => {
      // Update payout record
      await tx.doctorPayout.update({
        where: { id: payout.id },
        data: {
          status: 'COMPLETED',
          paystackTransferId: transferData.data.transfer_code,
          completedAt: new Date(),
        },
      });

      // Debit full wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { userId: doctor.user.id },
        data: { balanceKobo: { decrement: balanceKobo } },
      });

      // Wallet transaction record
      await tx.walletTransaction.create({
        data: {
          walletId: wallet!.id,
          type: 'PAYOUT',
          amountKobo: balanceKobo,
          balanceAfter: updatedWallet.balanceKobo,
          description: `Payout to ${doctor.bankAccount!.bankName} — ${doctor.bankAccount!.accountNumber}`,
          reference: payoutReference,
        },
      });
    });

    // Notify doctor
    void notificationService.createNotification({
      userId: doctor.user.id,
      type: 'PAYOUT_PROCESSED',
      title: 'Payout sent',
      message: `₦${(balanceKobo / 100).toFixed(0)} has been sent to your ${doctor.bankAccount.bankName} account ending in ${doctor.bankAccount.accountNumber.slice(-4)}.`,
      metadata: { payoutId: payout.id, amountKobo: balanceKobo },
    });

    await auditService.log({
      userId: adminUserId,
      action: 'PAYOUT_COMPLETED',
      resourceType: 'DoctorPayout',
      resourceId: payout.id,
      metadata: { amountKobo: balanceKobo, transferCode: transferData.data.transfer_code },
    });

    logger.info('Payout completed', {
      payoutId: payout.id,
      doctorProfileId,
      amountKobo: balanceKobo,
    });

    return { payout: { ...payout, status: 'COMPLETED' }, amountKobo: balanceKobo };
  } catch (error) {
    // Mark payout as failed
    await db.doctorPayout.update({
      where: { id: payout.id },
      data: {
        status: 'FAILED',
        failureReason: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    await auditService.log({
      userId: adminUserId,
      action: 'PAYOUT_FAILED',
      resourceType: 'DoctorPayout',
      resourceId: payout.id,
      metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
    });

    logger.error('Payout failed', { payoutId: payout.id, error });
    throw new AppError(502, 'PAYOUT_FAILED', 'Payout transfer failed. Please try again or contact support.');
  }
};

// ─── Admin: list all payouts ──────────────────────────────────

export const listPayouts = async (
  page: number,
  pageSize: number,
  doctorProfileId?: string,
) => {
  const where = doctorProfileId ? { doctorProfileId } : {};

  const [items, total] = await Promise.all([
    db.doctorPayout.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        doctor: {
          select: {
            discipline: true,
            bankAccount: {
              select: { bankName: true, accountNumber: true, accountName: true },
            },
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    }),
    db.doctorPayout.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
};

// ─── Admin: get a single doctor's payout summary ─────────────

export const getDoctorPayoutSummary = async (doctorProfileId: string) => {
  const [payouts, totalPaidOut] = await Promise.all([
    db.doctorPayout.findMany({
      where: { doctorProfileId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.doctorPayout.aggregate({
      where: { doctorProfileId, status: 'COMPLETED' },
      _sum: { amountKobo: true },
    }),
  ]);

  return {
    totalPaidOutKobo: totalPaidOut._sum.amountKobo ?? 0,
    totalPaidOutNGN: ((totalPaidOut._sum.amountKobo ?? 0) / 100).toFixed(2),
    recentPayouts: payouts,
  };
};

export const payoutsService = {
  getPaystackBanks,
  verifyBankAccount,
  saveDoctorBankAccount,
  getDoctorBankAccount,
  initiatePayout,
  listPayouts,
  getDoctorPayoutSummary,
};
