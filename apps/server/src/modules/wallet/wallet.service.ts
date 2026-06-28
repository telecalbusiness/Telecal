// ============================================================
// TELECAL — WALLET SERVICE
// ============================================================

import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { AppError, NotFoundError } from '../../utils/errors';
import { notificationService } from '../notifications/notifications.service';

// Get or create wallet for a user
export const getOrCreateWallet = async (userId: string) => {
  const existing = await prisma.wallet.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.wallet.create({
    data: { userId, balanceKobo: 0 },
  });
};

// Get wallet with recent transactions
export const getWalletWithHistory = async (userId: string) => {
  const wallet = await getOrCreateWallet(userId);

  const transactions = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return { ...wallet, transactions };
};

// Credit wallet (top-up confirmed by Paystack webhook)
export const creditWallet = async (
  userId: string,
  amountKobo: number,
  reference: string,
  description = 'Wallet top-up',
) => {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId },
      create: { userId, balanceKobo: amountKobo },
      update: { balanceKobo: { increment: amountKobo } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'TOPUP',
        amountKobo,
        balanceAfter: wallet.balanceKobo,
        description,
        reference,
      },
    });

    logger.info('Wallet credited', { userId, amountKobo, reference });

    // Notify user of top-up
    void notificationService.createNotification({
      userId,
      type: 'PAYMENT_CONFIRMED',
      title: 'Wallet topped up',
      message: `₦${(amountKobo / 100).toLocaleString()} has been added to your wallet. New balance: ₦${(wallet.balanceKobo / 100).toLocaleString()}`,
      metadata: { reference, amountKobo },
    });

    return wallet;
  });
};

// Debit wallet for a consultation or investigation
export const debitWallet = async (
  userId: string,
  amountKobo: number,
  description: string,
  appointmentId?: string,
) => {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });

    if (!wallet) {
      throw new NotFoundError('Wallet');
    }

    if (wallet.balanceKobo < amountKobo) {
      throw new AppError(
        402,
        'INSUFFICIENT_BALANCE',
        `Insufficient wallet balance. You need ₦${(amountKobo / 100).toFixed(0)} but have ₦${(wallet.balanceKobo / 100).toFixed(0)}.`,
      );
    }

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceKobo: { decrement: amountKobo } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEBIT',
        amountKobo,
        balanceAfter: updated.balanceKobo,
        description,
        appointmentId: appointmentId ?? null,
      },
    });

    logger.info('Wallet debited', { userId, amountKobo, description });
    return updated;
  });
};