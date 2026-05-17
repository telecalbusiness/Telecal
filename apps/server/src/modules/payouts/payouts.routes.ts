// ============================================================
// TELECAL — PAYOUTS ROUTES
//
// Doctor routes (require doctor auth):
//   GET  /payouts/banks                — list Nigerian banks
//   POST /payouts/bank-account         — save bank account
//   GET  /payouts/bank-account         — get saved bank account
//   GET  /payouts/me                   — doctor's payout history
//
// Admin routes live in admin.routes.ts
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireDoctor } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { sendSuccess } from '../../utils/response';
import { payoutsService } from './payouts.service';

export const payoutsRouter = Router();
payoutsRouter.use(requireAuth, requireDoctor);

// GET /payouts/banks — list all Nigerian banks from Paystack
payoutsRouter.get(
  '/banks',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const banks = await payoutsService.getPaystackBanks();
      sendSuccess(res, banks);
    } catch (err) {
      next(err);
    }
  },
);

// POST /payouts/bank-account — save or update bank account
payoutsRouter.post(
  '/bank-account',
  validateBody(
    z.object({
      accountNumber: z
        .string()
        .length(10, 'Account number must be exactly 10 digits')
        .regex(/^\d+$/, 'Account number must contain only digits'),
      bankCode: z.string().min(1, 'Bank code is required'),
      bankName: z.string().min(1, 'Bank name is required'),
    }),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accountNumber, bankCode, bankName } = req.body as {
        accountNumber: string;
        bankCode: string;
        bankName: string;
      };

      const bankAccount = await payoutsService.saveDoctorBankAccount(
        req.user!.id,
        accountNumber,
        bankCode,
        bankName,
      );

      sendSuccess(res, bankAccount, 'Bank account saved and verified successfully');
    } catch (err) {
      next(err);
    }
  },
);

// GET /payouts/bank-account — get doctor's saved bank account
payoutsRouter.get(
  '/bank-account',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bankAccount = await payoutsService.getDoctorBankAccount(req.user!.id);
      sendSuccess(res, bankAccount);
    } catch (err) {
      next(err);
    }
  },
);

// GET /payouts/me — doctor's own payout history
payoutsRouter.get(
  '/me',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { prisma } = await import('../../lib/prisma');
      const { NotFoundError } = await import('../../utils/errors');

      const doctor = await prisma.doctorProfile.findUnique({
        where: { userId: req.user!.id },
      });
      if (!doctor) throw new NotFoundError('Doctor profile');

      const summary = await payoutsService.getDoctorPayoutSummary(doctor.id);
      sendSuccess(res, summary);
    } catch (err) {
      next(err);
    }
  },
);
