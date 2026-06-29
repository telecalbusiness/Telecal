import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requirePatient } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';
import { getWalletWithHistory } from './wallet.service';
import { initializeTransaction } from '../../lib/paystack';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../utils/errors';
import { z } from 'zod';
import { validateBody } from '../../middleware/validate';
import { config } from '../../config';

export const walletRouter = Router();
walletRouter.use(requireAuth);

// GET /wallet — get balance and transaction history
walletRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wallet = await getWalletWithHistory(req.user!.id);
      sendSuccess(res, wallet);
    } catch (err) { next(err); }
  },
);

// POST /wallet/topup/initialize — initialize Paystack top-up
walletRouter.post(
  '/topup/initialize',
  requirePatient,
  validateBody(z.object({
    amountNGN: z.number().int().min(500, 'Minimum top-up is ₦500').max(1_000_000),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { email: true, firstName: true },
      });
      if (!user) throw new NotFoundError('User');

      const amountKobo = (req.body.amountNGN as number) * 100;
      const reference = `TC-WALLET-${req.user!.id.slice(0, 8).toUpperCase()}-${Date.now()}`;

      // Verify the patient profile exists before creating any records
      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: req.user!.id },
      });
      if (!patientProfile) throw new NotFoundError('Patient profile');

      // Store pending top-up as a payment record so the webhook can find it
      await prisma.payment.create({
        data: {
          patientId: patientProfile.id,
          purpose: 'WALLET_TOPUP',
          paystackReference: reference,
          amountKobo,
          currency: 'NGN',
          status: 'PENDING',
        },
      });

      const paystackData = await initializeTransaction({
        email: user.email,
        amountKobo,
        reference,
        callbackUrl: `${config.CLIENT_URL}/payment/success?reference=${reference}&type=wallet`,
        metadata: {
          purpose: 'WALLET_TOPUP',
          userId: req.user!.id,
        },
      });

      sendSuccess(res, {
        authorizationUrl: paystackData.data.authorization_url,
        reference,
        amountKobo,
      });
    } catch (err) { next(err); }
  },
);