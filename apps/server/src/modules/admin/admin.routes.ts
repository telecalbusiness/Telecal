// ============================================================
// TELECAL — ADMIN ROUTES
// All routes require ADMIN role.
// Every action is audit-logged.
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate';
import { sendSuccess } from '../../utils/response';
import { prisma } from '../../lib/prisma';
import { NotFoundError, AppError } from '../../utils/errors';
import { auditService } from '../audit/audit.service';
import { storageService } from '../../lib/storage';
import { notificationService } from '../notifications/notifications.service';
import { emailService } from '../../lib/email';
import { earningsService } from '../earnings/earnings.service';
import { payoutsService } from '../payouts/payouts.service';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

const idParamSchema = z.object({ id: z.string().uuid() });
const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Doctor management ────────────────────────────────────────

// GET /admin/doctors — list all doctors with status filter
adminRouter.get(
  '/doctors',
  validateQuery(paginationSchema.extend({ status: z.string().optional() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize, status } = req.query as unknown as {
        page: number; pageSize: number; status?: string;
      };

      const where = status ? { status: status as never } : {};
      const [items, total] = await Promise.all([
        prisma.doctorProfile.findMany({
          where,
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, createdAt: true } },
            credentials: { select: { id: true, fileName: true, fileType: true, uploadedAt: true } },
            adminReviews: { orderBy: { reviewedAt: 'desc' }, take: 1 },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.doctorProfile.count({ where }),
      ]);

      sendSuccess(res, { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
    } catch (err) { next(err); }
  },
);

// GET /admin/doctors/:doctorId/credentials/:credentialId — stream file to admin
adminRouter.get(
  '/doctors/:doctorId/credentials/:credentialId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Fetch the credential record — includes fileKey which is never sent to frontend
      const credential = await prisma.doctorCredential.findFirst({
        where: {
          id: req.params['credentialId']!,
          doctorId: req.params['doctorId']!,
        },
      });

      if (!credential) throw new NotFoundError('Credential');

      // Audit log every file access
      await auditService.log({
        userId: req.user!.id,
        action: 'RECORDING_ACCESSED',
        resourceType: 'DoctorCredential',
        resourceId: credential.id,
        ipAddress: req.ip,
        metadata: { doctorId: req.params['doctorId'], fileName: credential.fileName },
      });

      // Fetch the actual file buffer from storage
      const buffer = await storageService.getBuffer(credential.fileKey);

      // Set headers so browser displays or downloads the file correctly
      res.setHeader('Content-Type', credential.fileType);
      res.setHeader('Content-Length', buffer.length);

      const isDownload = req.query['download'] === '1';
      res.setHeader(
        'Content-Disposition',
        `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(credential.fileName)}"`,
      );
      // Prevent browser from caching sensitive documents
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');

      res.send(buffer);
    } catch (err) { next(err); }
  },
);

// PATCH /admin/doctors/:id/approve
adminRouter.patch(
  '/doctors/:id/approve',
  validateParams(idParamSchema),
  validateBody(z.object({ notes: z.string().max(500).optional() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doctor = await prisma.doctorProfile.findUnique({
        where: { id: req.params['id']! },
        include: { user: { select: { id: true, firstName: true, email: true } } },
      });
      if (!doctor) throw new NotFoundError('Doctor');
      if (doctor.status === 'VERIFIED') {
        throw new AppError(409, 'CONFLICT', 'Doctor is already verified');
      }

      await prisma.$transaction(async (tx) => {
        await tx.doctorProfile.update({
          where: { id: doctor.id },
          data: { status: 'VERIFIED' },
        });
        await tx.doctorAdminReview.create({
          data: {
            doctorId: doctor.id,
            adminId: req.user!.id,
            action: 'VERIFIED',
            notes: req.body.notes ?? null,
          },
        });
      });

      // Notify the doctor
      await notificationService.createNotification({
        userId: doctor.user.id,
        type: 'DOCTOR_APPROVED',
        title: 'Account approved',
        message: 'Your credentials have been verified. You can now go online and accept patients.',
      });

      void emailService.sendDoctorApproved({
        doctorEmail: doctor.user.email,
        doctorFirstName: doctor.user.firstName,
      });

      await auditService.log({
        userId: req.user!.id,
        action: 'DOCTOR_APPROVED',
        resourceType: 'DoctorProfile',
        resourceId: doctor.id,
      });

      sendSuccess(res, null, `Dr. ${doctor.user.firstName} approved successfully`);
    } catch (err) { next(err); }
  },
);

// PATCH /admin/doctors/:id/reject
adminRouter.patch(
  '/doctors/:id/reject',
  validateParams(idParamSchema),
  validateBody(z.object({ reason: z.string().min(10, 'Please provide a reason for rejection') })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doctor = await prisma.doctorProfile.findUnique({
        where: { id: req.params['id']! },
        include: { user: { select: { id: true, firstName: true, email: true } } },
      });
      if (!doctor) throw new NotFoundError('Doctor');

      await prisma.$transaction(async (tx) => {
        await tx.doctorProfile.update({
          where: { id: doctor.id },
          data: { status: 'REJECTED' },
        });
        await tx.doctorAdminReview.create({
          data: {
            doctorId: doctor.id,
            adminId: req.user!.id,
            action: 'REJECTED',
            notes: req.body.reason,
          },
        });
      });

      await notificationService.createNotification({
        userId: doctor.user.id,
        type: 'DOCTOR_REJECTED',
        title: 'Account verification unsuccessful',
        message: `Your credentials could not be verified. Reason: ${req.body.reason as string}. Please contact support.`,
      });

      void emailService.sendDoctorRejected({
        doctorEmail: doctor.user.email,
        doctorFirstName: doctor.user.firstName,
        reason: req.body.reason as string,
      });

      await auditService.log({
        userId: req.user!.id,
        action: 'DOCTOR_REJECTED',
        resourceType: 'DoctorProfile',
        resourceId: doctor.id,
      });

      sendSuccess(res, null, 'Doctor rejected');
    } catch (err) { next(err); }
  },
);

// PATCH /admin/doctors/:id/suspend
adminRouter.patch(
  '/doctors/:id/suspend',
  validateParams(idParamSchema),
  validateBody(z.object({ reason: z.string().min(10) })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doctor = await prisma.doctorProfile.findUnique({
        where: { id: req.params['id']! },
      });
      if (!doctor) throw new NotFoundError('Doctor');

      await prisma.doctorProfile.update({
        where: { id: doctor.id },
        data: { status: 'SUSPENDED', presence: 'OFFLINE', onlineSince: null },
      });

      await auditService.log({
        userId: req.user!.id,
        action: 'DOCTOR_SUSPENDED',
        resourceType: 'DoctorProfile',
        resourceId: doctor.id,
        metadata: { reason: req.body.reason as string },
      });

      sendSuccess(res, null, 'Doctor suspended');
    } catch (err) { next(err); }
  },
);

// GET /admin/doctors/:id/reviews — all patient reviews for a doctor
adminRouter.get(
  '/doctors/:doctorId/reviews',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reviews = await prisma.appointmentReview.findMany({
        where: { doctorId: req.params['doctorId']! },
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: {
              fileNumber: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
          appointment: {
            select: { consultationType: true, sessionEndedAt: true },
          },
        },
      });

      sendSuccess(res, reviews);
    } catch (err) { next(err); }
  },
);

// GET /admin/doctors/:id — full doctor detail
adminRouter.get(
  '/doctors/:id',
  validateParams(idParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doctorId = req.params['id']!;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());

      const [doctor, totalAppointments, monthAppointments, weekAppointments,
        completedAppointments, totalInvestigations, totalPrescriptions,
        uniquePatients, totalRevenue, recentAppointments] = await Promise.all([

        prisma.doctorProfile.findUnique({
          where: { id: doctorId },
          include: {
            user: {
              select: {
                id: true, firstName: true, lastName: true, email: true,
                isEmailVerified: true, isActive: true,
                lastLoginAt: true, createdAt: true, avatarUrl: true,
              },
            },
            credentials: {
              select: {
                id: true, fileName: true, fileType: true,
                fileSizeBytes: true, uploadedAt: true,
              },
              orderBy: { uploadedAt: 'desc' },
            },
            adminReviews: { orderBy: { reviewedAt: 'desc' } },
          },
        }),

        prisma.appointment.count({
          where: { doctorId, deletedAt: null },
        }),

        prisma.appointment.count({
          where: {
            doctorId, deletedAt: null,
            createdAt: { gte: startOfMonth },
          },
        }),

        prisma.appointment.count({
          where: {
            doctorId, deletedAt: null,
            createdAt: { gte: startOfWeek },
          },
        }),

        prisma.appointment.count({
          where: { doctorId, status: 'COMPLETED', deletedAt: null },
        }),

        prisma.investigation.count({
          where: { assignedDoctorId: doctorId },
        }),

        prisma.prescription.count({
          where: { doctorId, status: 'ISSUED' },
        }),

        // Count unique patients seen
        prisma.appointment.findMany({
          where: { doctorId, status: 'COMPLETED', deletedAt: null },
          select: { patientId: true },
          distinct: ['patientId'],
        }),

        // Total revenue generated from completed appointments
        prisma.payment.aggregate({
          where: {
            appointment: { doctorId },
            status: 'SUCCESSFUL',
          },
          _sum: { amountKobo: true },
        }),

        // 5 most recent appointments
        prisma.appointment.findMany({
          where: { doctorId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            patient: {
              select: {
                fileNumber: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        }),
      ]);

      if (!doctor) throw new NotFoundError('Doctor');

      sendSuccess(res, {
        ...doctor,
        stats: {
          totalAppointments,
          monthAppointments,
          weekAppointments,
          completedAppointments,
          totalInvestigations,
          totalPrescriptions,
          uniquePatientsSeen: uniquePatients.length,
          revenueGeneratedKobo: totalRevenue._sum.amountKobo ?? 0,
          revenueGeneratedNGN: ((totalRevenue._sum.amountKobo ?? 0) / 100).toFixed(2),
          completionRate: totalAppointments > 0
            ? Math.round((completedAppointments / totalAppointments) * 100)
            : 0,
        },
        recentAppointments,
      });
    } catch (err) { next(err); }
  },
);

// ─── Patient management ───────────────────────────────────────

adminRouter.get(
  '/patients',
  validateQuery(paginationSchema.extend({ search: z.string().optional() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize, search } = req.query as unknown as {
        page: number; pageSize: number; search?: string;
      };

      const where = search
        ? {
            OR: [
              { fileNumber: { contains: search, mode: 'insensitive' as const } },
              { user: { email: { contains: search, mode: 'insensitive' as const } } },
              { user: { firstName: { contains: search, mode: 'insensitive' as const } } },
              { user: { lastName: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {};

      const [items, total] = await Promise.all([
        prisma.patientProfile.findMany({
          where,
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, createdAt: true, isActive: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.patientProfile.count({ where }),
      ]);

      sendSuccess(res, { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
    } catch (err) { next(err); }
  },
);

// GET /admin/patients/:id — full patient detail
adminRouter.get(
  '/patients/:id',
  validateParams(idParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = req.params['id']!;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [patient, totalAppointments, completedAppointments,
        monthAppointments, totalInvestigations, totalSpent,
        totalPrescriptions, recentAppointments] = await Promise.all([

        prisma.patientProfile.findUnique({
          where: { id: patientId },
          include: {
            user: {
              select: {
                id: true, firstName: true, lastName: true, email: true,
                isEmailVerified: true, isActive: true,
                lastLoginAt: true, createdAt: true, avatarUrl: true,
              },
            },
          },
        }),

        prisma.appointment.count({
          where: { patientId, deletedAt: null },
        }),

        prisma.appointment.count({
          where: { patientId, status: 'COMPLETED', deletedAt: null },
        }),

        prisma.appointment.count({
          where: {
            patientId, deletedAt: null,
            createdAt: { gte: startOfMonth },
          },
        }),

        prisma.investigation.count({
          where: { patientId },
        }),

        prisma.payment.aggregate({
          where: { patientId, status: 'SUCCESSFUL' },
          _sum: { amountKobo: true },
        }),

        prisma.prescription.count({
          where: { patientId, status: 'ISSUED' },
        }),

        prisma.appointment.findMany({
          where: { patientId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            doctor: {
              select: {
                discipline: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
            payment: { select: { status: true, amountKobo: true } },
          },
        }),
      ]);

      if (!patient) throw new NotFoundError('Patient');

      sendSuccess(res, {
        ...patient,
        stats: {
          totalAppointments,
          completedAppointments,
          monthAppointments,
          totalInvestigations,
          totalPrescriptions,
          totalSpentKobo: totalSpent._sum.amountKobo ?? 0,
          totalSpentNGN: ((totalSpent._sum.amountKobo ?? 0) / 100).toFixed(2),
          completionRate: totalAppointments > 0
            ? Math.round((completedAppointments / totalAppointments) * 100)
            : 0,
        },
        recentAppointments,
      });
    } catch (err) { next(err); }
  },
);

// ─── Appointments oversight ───────────────────────────────────

adminRouter.get(
  '/appointments',
  validateQuery(paginationSchema.extend({ status: z.string().optional() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize, status } = req.query as unknown as {
        page: number; pageSize: number; status?: string;
      };

      const where = status ? { status: status as never, deletedAt: null } : { deletedAt: null };
      const [items, total] = await Promise.all([
        prisma.appointment.findMany({
          where,
          include: {
            patient: { select: { fileNumber: true, user: { select: { firstName: true, lastName: true } } } },
            doctor: { select: { discipline: true, user: { select: { firstName: true, lastName: true } } } },
            payment: { select: { status: true, amountKobo: true, paidAt: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.appointment.count({ where }),
      ]);

      sendSuccess(res, { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
    } catch (err) { next(err); }
  },
);

// ─── Platform analytics ───────────────────────────────────────

adminRouter.get('/analytics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date(new Date().setHours(0, 0, 0, 0));

    const [
      totalPatients, totalDoctors, pendingDoctors,
      totalAppointments, appointmentsToday,
      totalRevenue, onlineDoctors,
      totalInvestigations,
    ] = await Promise.all([
      prisma.patientProfile.count(),
      prisma.doctorProfile.count({ where: { status: 'VERIFIED' } }),
      prisma.doctorProfile.count({ where: { status: 'PENDING_VERIFICATION' } }),
      prisma.appointment.count({ where: { deletedAt: null } }),
      prisma.appointment.count({ where: { createdAt: { gte: today }, deletedAt: null } }),
      prisma.payment.aggregate({
        where: { status: 'SUCCESSFUL' },
        _sum: { amountKobo: true },
      }),
      prisma.doctorProfile.count({ where: { presence: 'ONLINE' } }),
      prisma.investigation.count(),
    ]);

    sendSuccess(res, {
      users: { totalPatients, totalDoctors, pendingDoctors, onlineDoctors },
      appointments: { total: totalAppointments, today: appointmentsToday },
      investigations: { total: totalInvestigations },
      revenue: {
        totalKobo: totalRevenue._sum.amountKobo ?? 0,
        totalNGN: ((totalRevenue._sum.amountKobo ?? 0) / 100).toFixed(2),
      },
    });
  } catch (err) { next(err); }
});

// ─── Audit log access (admin only) ────────────────────────────

adminRouter.get(
  '/audit-logs',
  validateQuery(paginationSchema.extend({
    userId: z.string().uuid().optional(),
    action: z.string().optional(),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize, userId, action } = req.query as unknown as {
        page: number; pageSize: number; userId?: string; action?: string;
      };

      const where = {
        ...(userId ? { userId } : {}),
        ...(action ? { action: action as never } : {}),
      };

      const [items, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.auditLog.count({ where }),
      ]);

      sendSuccess(res, { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
    } catch (err) { next(err); }
  },
);

// ─── Doctor ratings (admin-only view) ────────────────────────

adminRouter.post(
  '/doctors/:id/rate',
  validateParams(idParamSchema),
  validateBody(z.object({
    appointmentId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    notes: z.string().max(500).optional(),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doctor = await prisma.doctorProfile.findUnique({ where: { id: req.params['id']! } });
      if (!doctor) throw new NotFoundError('Doctor');

      await prisma.$transaction(async (tx) => {
        await tx.doctorRating.create({
          data: {
            doctorId: doctor.id,
            appointmentId: req.body.appointmentId as string,
            rating: req.body.rating as number,
            notes: req.body.notes as string | undefined ?? null,
          },
        });

        // Recalculate average
        const agg = await tx.doctorRating.aggregate({
          where: { doctorId: doctor.id },
          _avg: { rating: true },
          _count: { rating: true },
        });

        await tx.doctorProfile.update({
          where: { id: doctor.id },
          data: {
            averageRating: agg._avg.rating,
            totalRatings: agg._count.rating,
          },
        });
      });

      sendSuccess(res, null, 'Rating submitted');
    } catch (err) { next(err); }
  },
);

// ─── Earnings management ──────────────────────────────────────

// GET /admin/earnings — list all earnings across all doctors
adminRouter.get(
  '/earnings',
  validateQuery(paginationSchema.extend({ doctorProfileId: z.string().uuid().optional() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize, doctorProfileId } = req.query as unknown as {
        page: number; pageSize: number; doctorProfileId?: string;
      };
      const result = await earningsService.listAllEarnings(page, pageSize, doctorProfileId);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },
);

// GET /admin/earnings/commission — get current commission settings
adminRouter.get(
  '/earnings/commission',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await earningsService.getCommissionSettings();
      sendSuccess(res, settings);
    } catch (err) { next(err); }
  },
);

// PATCH /admin/earnings/commission — update commission split
adminRouter.patch(
  '/earnings/commission',
  validateBody(z.object({
    doctorPercent: z.number().int().min(1).max(99),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { doctorPercent } = req.body as { doctorPercent: number };
      const result = await earningsService.updateCommissionSettings(doctorPercent, req.user!.id);
      sendSuccess(res, result, 'Commission settings updated');
    } catch (err) { next(err); }
  },
);

// POST /admin/earnings/:earningId/reverse — reverse a credited earning
adminRouter.post(
  '/earnings/:earningId/reverse',
  validateParams(z.object({ earningId: z.string().uuid() })),
  validateBody(z.object({ reason: z.string().min(10, 'Please provide a reason') })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await earningsService.reverseEarning(
        req.params['earningId']!,
        req.user!.id,
        req.body.reason as string,
      );
      sendSuccess(res, null, 'Earning reversed successfully');
    } catch (err) { next(err); }
  },
);

// ─── Payouts management ───────────────────────────────────────

// GET /admin/payouts — list all payouts
adminRouter.get(
  '/payouts',
  validateQuery(paginationSchema.extend({ doctorProfileId: z.string().uuid().optional() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize, doctorProfileId } = req.query as unknown as {
        page: number; pageSize: number; doctorProfileId?: string;
      };
      const result = await payoutsService.listPayouts(page, pageSize, doctorProfileId);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },
);

// GET /admin/payouts/doctors/:doctorProfileId/summary — doctor payout summary
adminRouter.get(
  '/payouts/doctors/:doctorProfileId/summary',
  validateParams(z.object({ doctorProfileId: z.string().uuid() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await payoutsService.getDoctorPayoutSummary(req.params['doctorProfileId']!);
      sendSuccess(res, summary);
    } catch (err) { next(err); }
  },
);

// POST /admin/payouts/doctors/:doctorProfileId/pay — initiate payout to a doctor
adminRouter.post(
  '/payouts/doctors/:doctorProfileId/pay',
  validateParams(z.object({ doctorProfileId: z.string().uuid() })),
  validateBody(z.object({
    periodStart: z.string().datetime({ message: 'periodStart must be an ISO date string' }),
    periodEnd: z.string().datetime({ message: 'periodEnd must be an ISO date string' }),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { periodStart, periodEnd } = req.body as { periodStart: string; periodEnd: string };
      const result = await payoutsService.initiatePayout(
        req.params['doctorProfileId']!,
        req.user!.id,
        new Date(periodStart),
        new Date(periodEnd),
      );
      sendSuccess(res, result, 'Payout initiated successfully');
    } catch (err) { next(err); }
  },
);
