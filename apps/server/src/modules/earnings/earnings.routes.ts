// ============================================================
// TELECAL — EARNINGS ROUTES
//
// Doctor routes:
//   GET /earnings/me          — doctor views their own summary
//   GET /earnings/me/history  — paginated earnings history
//
// These routes are for doctors only.
// Admin earnings endpoints live in admin.routes.ts.
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireDoctor } from '../../middleware/auth';
import { validateQuery } from '../../middleware/validate';
import { sendSuccess } from '../../utils/response';
import { earningsService } from './earnings.service';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../utils/errors';

export const earningsRouter = Router();
earningsRouter.use(requireAuth, requireDoctor);

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// GET /earnings/me — summary (balance, totals, recent list)
earningsRouter.get(
  '/me',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await earningsService.getDoctorEarningSummary(req.user!.id);
      sendSuccess(res, summary);
    } catch (err) {
      next(err);
    }
  },
);

// GET /earnings/me/history — full paginated history
earningsRouter.get(
  '/me/history',
  validateQuery(paginationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize } = req.query as unknown as {
        page: number;
        pageSize: number;
      };

      const doctor = await prisma.doctorProfile.findUnique({
        where: { userId: req.user!.id },
      });
      if (!doctor) throw new NotFoundError('Doctor profile');

      const result = await earningsService.listAllEarnings(page, pageSize, doctor.id);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);
