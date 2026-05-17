// ============================================================
// TELECAL — EARNINGS SERVICE
//
// Handles doctor commission calculation and crediting.
//
// Flow (triggered automatically on appointment COMPLETED):
//  1. Read commission percentages from SystemConfig
//  2. Calculate doctor share and platform share
//  3. Create DoctorEarning record (snapshot of the split)
//  4. Credit doctor's in-app wallet
//  5. Notify doctor of new earnings
//
// The commission percentages live in SystemConfig so admin
// can change them at any time without a code deploy.
// ============================================================

import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { NotFoundError, AppError } from '../../utils/errors';
import { auditService } from '../audit/audit.service';
import { notificationService } from '../notifications/notifications.service';

// Cast prisma to any so new models (doctorEarning) are accessible
// before the editor picks up the regenerated Prisma client.
// This is safe — the models exist in the schema and will be
// fully typed after running: npx prisma generate
const db = prisma as any;

// ─── Get commission config from DB ───────────────────────────
// Falls back to 75/25 split if config rows are missing.

const getCommissionConfig = async (): Promise<{
  doctorPercent: number;
  platformPercent: number;
}> => {
  const configs = await prisma.systemConfig.findMany({
    where: {
      key: { in: ['DOCTOR_COMMISSION_PERCENT', 'PLATFORM_COMMISSION_PERCENT'] },
    },
  });

  const doctorConfig = configs.find((c) => c.key === 'DOCTOR_COMMISSION_PERCENT');
  const platformConfig = configs.find((c) => c.key === 'PLATFORM_COMMISSION_PERCENT');

  const doctorPercent = doctorConfig ? parseInt(doctorConfig.value, 10) : 75;
  const platformPercent = platformConfig ? parseInt(platformConfig.value, 10) : 25;

  // Sanity check — must add up to 100
  if (doctorPercent + platformPercent !== 100) {
    logger.warn('Commission percentages do not add up to 100, using defaults', {
      doctorPercent,
      platformPercent,
    });
    return { doctorPercent: 75, platformPercent: 25 };
  }

  return { doctorPercent, platformPercent };
};

// ─── Credit earnings after appointment completes ─────────────
//
// Called by appointments.service.ts inside completeAppointment.
// This is the core of the earnings system.

export const creditDoctorEarnings = async (
  appointmentId: string,
): Promise<void> => {
  // Load appointment with all required relations
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      doctor: {
        include: {
          user: { select: { id: true, firstName: true } },
        },
      },
      payment: { select: { amountKobo: true, status: true } },
      earning: true, // Check if already credited (idempotency guard)
    },
  });

  if (!appointment) {
    logger.warn('creditDoctorEarnings: appointment not found', { appointmentId });
    return;
  }

  // No doctor assigned — nothing to credit
  if (!appointment.doctor || !appointment.doctorId) {
    logger.info('creditDoctorEarnings: no doctor on appointment, skipping', { appointmentId });
    return;
  }

  // Payment must be confirmed — do not credit if unpaid
  if (!appointment.payment || appointment.payment.status !== 'SUCCESSFUL') {
    logger.warn('creditDoctorEarnings: no successful payment found, skipping', { appointmentId });
    return;
  }

  // Idempotency — never double-credit
  if (appointment.earning) {
    logger.info('creditDoctorEarnings: earning already exists, skipping', { appointmentId });
    return;
  }

  const grossAmountKobo = appointment.payment.amountKobo;
  const { doctorPercent } = await getCommissionConfig();

  const doctorShareKobo = Math.floor((grossAmountKobo * doctorPercent) / 100);
  const platformShareKobo = grossAmountKobo - doctorShareKobo; // Avoids rounding drift

  const doctorUserId = appointment.doctor.user.id;

  // Run everything in a transaction — earning record + wallet credit
  await prisma.$transaction(async (tx: any) => {
    // 1. Create earning record (immutable audit trail)
    await tx.doctorEarning.create({
      data: {
        doctorProfileId: appointment.doctorId!,
        appointmentId,
        grossAmountKobo,
        doctorShareKobo,
        platformShareKobo,
        commissionPercent: doctorPercent,
        status: 'CREDITED',
        creditedAt: new Date(),
      },
    });

    // 2. Upsert doctor wallet and credit earnings
    const wallet = await tx.wallet.upsert({
      where: { userId: doctorUserId },
      create: { userId: doctorUserId, balanceKobo: doctorShareKobo },
      update: { balanceKobo: { increment: doctorShareKobo } },
    });

    // 3. Record wallet transaction
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'EARNINGS_CREDIT',
        amountKobo: doctorShareKobo,
        balanceAfter: wallet.balanceKobo,
        description: `Earnings from consultation — ${doctorPercent}% of ₦${(grossAmountKobo / 100).toFixed(0)}`,
        appointmentId,
      },
    });
  });

  // 4. Notify doctor (non-blocking — never fails the main flow)
  void notificationService.createNotification({
    userId: doctorUserId,
    type: 'EARNINGS_CREDITED',
    title: 'Earnings credited',
    message: `₦${(doctorShareKobo / 100).toFixed(0)} has been added to your wallet from your last consultation.`,
    metadata: {
      appointmentId,
      amountKobo: doctorShareKobo,
    },
  });

  // 5. Audit log
  await auditService.log({
    action: 'EARNINGS_CREDITED',
    resourceType: 'DoctorEarning',
    resourceId: appointmentId,
    metadata: {
      doctorProfileId: appointment.doctorId,
      grossAmountKobo,
      doctorShareKobo,
      platformShareKobo,
      doctorPercent,
    },
  });

  logger.info('Doctor earnings credited', {
    appointmentId,
    doctorProfileId: appointment.doctorId,
    grossAmountKobo,
    doctorShareKobo,
    platformShareKobo,
  });
};

// ─── Get doctor's earning summary ────────────────────────────

export const getDoctorEarningSummary = async (doctorUserId: string) => {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId: doctorUserId },
  });
  if (!doctor) throw new NotFoundError('Doctor profile');

  const wallet = await prisma.wallet.findUnique({
    where: { userId: doctorUserId },
  });

  const [totalEarned, pendingPayout, thisMonthEarned, earningsList] =
    await Promise.all([
      // All-time total credited
      db.doctorEarning.aggregate({
        where: { doctorProfileId: doctor.id, status: 'CREDITED' },
        _sum: { doctorShareKobo: true },
      }),
      // Current wallet balance (what hasn't been paid out yet)
      Promise.resolve(wallet?.balanceKobo ?? 0),
      // This month's earnings
      db.doctorEarning.aggregate({
        where: {
          doctorProfileId: doctor.id,
          status: 'CREDITED',
          creditedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: { doctorShareKobo: true },
      }),
      // Recent earnings list
      db.doctorEarning.findMany({
        where: { doctorProfileId: doctor.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          appointment: {
            select: {
              consultationType: true,
              sessionEndedAt: true,
              patient: {
                select: {
                  fileNumber: true,
                },
              },
            },
          },
        },
      }),
    ]);

  return {
    walletBalanceKobo: pendingPayout,
    walletBalanceNGN: (pendingPayout / 100).toFixed(2),
    totalEarnedKobo: totalEarned._sum.doctorShareKobo ?? 0,
    totalEarnedNGN: ((totalEarned._sum.doctorShareKobo ?? 0) / 100).toFixed(2),
    thisMonthKobo: thisMonthEarned._sum.doctorShareKobo ?? 0,
    thisMonthNGN: ((thisMonthEarned._sum.doctorShareKobo ?? 0) / 100).toFixed(2),
    recentEarnings: earningsList,
  };
};

// ─── Admin: get all earnings (paginated) ─────────────────────

export const listAllEarnings = async (
  page: number,
  pageSize: number,
  doctorProfileId?: string,
) => {
  const where = doctorProfileId ? { doctorProfileId } : {};

  const [items, total] = await Promise.all([
    db.doctorEarning.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        doctor: {
          select: {
            discipline: true,
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        appointment: {
          select: {
            consultationType: true,
            sessionEndedAt: true,
          },
        },
      },
    }),
    db.doctorEarning.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
};

// ─── Admin: reverse an earning (dispute/refund) ───────────────

export const reverseEarning = async (
  earningId: string,
  adminUserId: string,
  reason: string,
) => {
  const earning = await db.doctorEarning.findUnique({
    where: { id: earningId },
    include: {
      doctor: { include: { user: { select: { id: true } } } },
    },
  });

  if (!earning) throw new NotFoundError('Earning record');
  if (earning.status === 'REVERSED') {
    throw new AppError(409, 'CONFLICT', 'This earning has already been reversed');
  }
  if (earning.status !== 'CREDITED') {
    throw new AppError(400, 'BAD_REQUEST', 'Only credited earnings can be reversed');
  }

  const doctorUserId = earning.doctor.user.id;

  await prisma.$transaction(async (tx: any) => {
    // Mark earning as reversed
    await tx.doctorEarning.update({
      where: { id: earningId },
      data: {
        status: 'REVERSED',
        reversedAt: new Date(),
        reversedBy: adminUserId,
        reverseReason: reason,
      },
    });

    // Debit the amount back from doctor's wallet
    const wallet = await tx.wallet.findUnique({ where: { userId: doctorUserId } });
    if (wallet && wallet.balanceKobo >= earning.doctorShareKobo) {
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceKobo: { decrement: earning.doctorShareKobo } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT',
          amountKobo: earning.doctorShareKobo,
          balanceAfter: updated.balanceKobo,
          description: `Earning reversal — ${reason}`,
          appointmentId: earning.appointmentId,
        },
      });
    }
  });

  await auditService.log({
    userId: adminUserId,
    action: 'RECORD_MODIFIED',
    resourceType: 'DoctorEarning',
    resourceId: earningId,
    metadata: { action: 'REVERSED', reason },
  });

  logger.info('Earning reversed', { earningId, adminUserId, reason });
};

// ─── Admin: get commission config ────────────────────────────

export const getCommissionSettings = async () => {
  return getCommissionConfig();
};

// ─── Admin: update commission config ─────────────────────────

export const updateCommissionSettings = async (
  doctorPercent: number,
  adminUserId: string,
) => {
  if (doctorPercent < 1 || doctorPercent > 99) {
    throw new AppError(400, 'BAD_REQUEST', 'Doctor percentage must be between 1 and 99');
  }

  const platformPercent = 100 - doctorPercent;

  await prisma.$transaction([
    prisma.systemConfig.upsert({
      where: { key: 'DOCTOR_COMMISSION_PERCENT' },
      update: { value: String(doctorPercent), updatedBy: adminUserId },
      create: { key: 'DOCTOR_COMMISSION_PERCENT', value: String(doctorPercent), updatedBy: adminUserId },
    }),
    prisma.systemConfig.upsert({
      where: { key: 'PLATFORM_COMMISSION_PERCENT' },
      update: { value: String(platformPercent), updatedBy: adminUserId },
      create: { key: 'PLATFORM_COMMISSION_PERCENT', value: String(platformPercent), updatedBy: adminUserId },
    }),
  ]);

  await auditService.log({
    userId: adminUserId,
    action: 'RECORD_MODIFIED',
    resourceType: 'SystemConfig',
    resourceId: 'COMMISSION',
    metadata: { doctorPercent, platformPercent },
  });

  logger.info('Commission settings updated', { doctorPercent, platformPercent, adminUserId });

  return { doctorPercent, platformPercent };
};

export const earningsService = {
  creditDoctorEarnings,
  getDoctorEarningSummary,
  listAllEarnings,
  reverseEarning,
  getCommissionSettings,
  updateCommissionSettings,
};
