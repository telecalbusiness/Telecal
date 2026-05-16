// ============================================================
// TELECAL — PATIENTS ROUTES
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requirePatient } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { sendSuccess } from '../../utils/response';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../utils/errors';

export const patientsRouter = Router();
patientsRouter.use(requireAuth, requirePatient);

// GET /patients/me/profile — patient profile
patientsRouter.get('/me/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.patientProfile.findUnique({
      where: { userId: req.user!.id },
    });
    if (!profile) throw new NotFoundError('Patient profile');
    sendSuccess(res, profile);
  } catch (err) { next(err); }
});

// PATCH /patients/me/profile — update health profile
patientsRouter.patch(
  '/me/profile',
  validateBody(z.object({
    dateOfBirth: z.string().datetime().optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    phoneNumber: z.string().max(20).optional(),
    bloodGroup: z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-']).optional(),
    genotype: z.enum(['AA','AS','SS','AC','SC']).optional(),
    allergies: z.string().max(500).optional(),
    emergencyContactName: z.string().max(100).optional(),
    emergencyContactPhone: z.string().max(20).optional(),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await prisma.patientProfile.update({
        where: { userId: req.user!.id },
        data: {
          ...req.body,
          dateOfBirth: req.body.dateOfBirth
            ? new Date(req.body.dateOfBirth as string)
            : undefined,
        },
      });
      sendSuccess(res, updated, 'Profile updated');
    } catch (err) { next(err); }
  },
);

// GET /patients/me/dashboard — summary for patient dashboard
patientsRouter.get('/me/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await prisma.patientProfile.findUnique({
      where: { userId: req.user!.id },
    });
    if (!patient) throw new NotFoundError('Patient profile');

    const [activeAppointments, recentAppointments, pendingInvestigations, unreadCount] =
      await Promise.all([
        prisma.appointment.count({
          where: { patientId: patient.id, status: { in: ['PAYMENT_CONFIRMED', 'ASSIGNED', 'IN_SESSION'] } },
        }),
        prisma.appointment.findMany({
          where: { patientId: patient.id, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        }),
        prisma.investigation.count({
          where: { patientId: patient.id, status: { in: ['PAYMENT_CONFIRMED', 'REPORT_UPLOADED', 'ASSIGNED', 'UNDER_REVIEW'] } },
        }),
        prisma.notification.count({ where: { userId: req.user!.id, isRead: false } }),
      ]);

    sendSuccess(res, {
      fileNumber: patient.fileNumber,
      activeAppointments,
      pendingInvestigations,
      unreadNotifications: unreadCount,
      recentAppointments,
    });
  } catch (err) { next(err); }
});

