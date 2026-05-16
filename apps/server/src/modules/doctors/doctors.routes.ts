// ============================================================
// TELECAL — DOCTORS ROUTES
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireDoctor } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { sendSuccess } from '../../utils/response';
import { prisma } from '../../lib/prisma';
import { NotFoundError, AppError } from '../../utils/errors';
import { assignmentEngine } from '../../lib/queue/assignmentEngine';
import { uploadCredentialFiles, handleMulterError } from '../../middleware/upload';
import { storageService } from '../../lib/storage';
import { uploadRateLimit } from '../../middleware/rateLimiter';

export const doctorsRouter = Router();
doctorsRouter.use(requireAuth, requireDoctor);

// GET /doctors/me/dashboard
doctorsRouter.get('/me/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.user!.id },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    if (!doctor) throw new NotFoundError('Doctor profile');

    if (doctor.status !== 'VERIFIED') {
      sendSuccess(res, { status: doctor.status, message: 'Account pending admin verification.' });
      return;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay()); // Sunday
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      activePatients,
      completedToday,
      completedThisWeek,
      completedThisMonth,
      pendingInvestigations,
      unreadCount,
    ] = await Promise.all([
      prisma.appointment.count({
        where: { doctorId: doctor.id, status: { in: ['ASSIGNED', 'IN_SESSION'] } },
      }),
      prisma.appointment.count({
        where: {
          doctorId: doctor.id,
          status: 'COMPLETED',
          sessionEndedAt: { gte: startOfToday },
        },
      }),
      prisma.appointment.count({
        where: {
          doctorId: doctor.id,
          status: 'COMPLETED',
          sessionEndedAt: { gte: startOfWeek },
        },
      }),
      prisma.appointment.count({
        where: {
          doctorId: doctor.id,
          status: 'COMPLETED',
          sessionEndedAt: { gte: startOfMonth },
        },
      }),
      prisma.investigation.count({
        where: {
          assignedDoctorId: doctor.id,
          status: { in: ['ASSIGNED', 'UNDER_REVIEW', 'REPORT_UPLOADED'] },
        },
      }),
      prisma.notification.count({
        where: { userId: req.user!.id, isRead: false },
      }),
    ]);

    sendSuccess(res, {
      doctor: {
        id: doctor.id,
        name: `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`,
        discipline: doctor.discipline,
        presence: doctor.presence,
        onlineSince: doctor.onlineSince,
        currentPatientCount: doctor.currentPatientCount,
      },
      stats: {
        activePatients,
        completedToday,
        completedThisWeek,
        completedThisMonth,
        pendingInvestigations,
        unreadNotifications: unreadCount,
      },
    });
  } catch (err) { next(err); }
});

// PATCH /doctors/me/profile — update bio, availability schedule
doctorsRouter.patch(
  '/me/profile',
  validateBody(z.object({
    bio: z.string().max(1000).optional(),
    specialization: z.string().max(100).optional(),
    availabilitySchedule: z.record(z.object({
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    }).nullable()).optional(),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await prisma.doctorProfile.update({
        where: { userId: req.user!.id },
        data: req.body,
        select: { id: true, bio: true, specialization: true, availabilitySchedule: true, updatedAt: true },
      });
      sendSuccess(res, updated, 'Profile updated');
    } catch (err) { next(err); }
  },
);

// POST /doctors/me/go-online
doctorsRouter.post('/me/go-online', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.user!.id },
      select: { id: true, status: true, presence: true },
    });
    if (!doctor) throw new NotFoundError('Doctor profile');

    if (doctor.status !== 'VERIFIED') {
      throw new AppError(403, 'FORBIDDEN', 'Your account must be verified before going online');
    }
    if (doctor.presence === 'ONLINE') {
      sendSuccess(res, null, 'Already online'); return;
    }

    await prisma.doctorProfile.update({
      where: { id: doctor.id },
      data: { presence: 'ONLINE', onlineSince: new Date() },
    });

    // Run the queue — this doctor may pick up waiting patients
    await assignmentEngine.processQueue();

    sendSuccess(res, null, 'You are now online and accepting patients');
  } catch (err) { next(err); }
});

// POST /doctors/me/go-offline
doctorsRouter.post('/me/go-offline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.doctorProfile.update({
      where: { userId: req.user!.id },
      data: { presence: 'OFFLINE', onlineSince: null },
    });
    sendSuccess(res, null, 'You are now offline');
  } catch (err) { next(err); }
});

// GET /doctors/me/appointments — doctor's own appointment list (delegated to appointments module)
// This route just returns a summary; full list is at GET /appointments
doctorsRouter.get('/me/patients', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: req.user!.id } });
    if (!doctor) throw new NotFoundError('Doctor profile');

    const patients = await prisma.appointment.findMany({
      where: { doctorId: doctor.id, status: { in: ['ASSIGNED', 'IN_SESSION'] }, deletedAt: null },
      include: {
        patient: {
          select: {
            fileNumber: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { assignedAt: 'asc' },
    });

    sendSuccess(res, patients);
  } catch (err) { next(err); }
});

// POST /doctors/me/rate-availability — set availability schedule
doctorsRouter.patch(
  '/me/availability',
  validateBody(z.object({
    schedule: z.record(
      z.enum(['monday','tuesday','wednesday','thursday','friday','saturday','sunday']),
      z.object({
        startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
        endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
      }).nullable(),
    ),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.doctorProfile.update({
        where: { userId: req.user!.id },
        data: { availabilitySchedule: req.body.schedule },
      });
      sendSuccess(res, null, 'Availability schedule updated');
    } catch (err) { next(err); }
  },
);

// POST /doctors/me/credentials — upload verification documents
doctorsRouter.post(
  '/me/credentials',
  uploadRateLimit,
  uploadCredentialFiles.array('credentials', 5),
  handleMulterError,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ success: false, error: { code: 'NO_FILES', message: 'No files provided' } });
        return;
      }

      const doctor = await prisma.doctorProfile.findUnique({ where: { userId: req.user!.id } });
      if (!doctor) throw new NotFoundError('Doctor profile');

      const saved = [];
      for (const file of files) {
        const stored = await storageService.save(file.buffer, file.originalname, file.mimetype, 'credentials');
        const record = await prisma.doctorCredential.create({
          data: {
            doctorId: doctor.id,
            fileName: stored.fileName,
            fileKey: stored.fileKey,
            fileType: stored.fileType,
            fileSizeBytes: stored.fileSizeBytes,
          },
        });
        saved.push({ id: record.id, fileName: record.fileName, fileType: record.fileType, uploadedAt: record.uploadedAt });
      }

      sendSuccess(res, { credentials: saved }, `${files.length} credential file(s) uploaded`);
    } catch (err) { next(err); }
  },
);

// GET /doctors/me/credentials — list uploaded credentials
doctorsRouter.get(
  '/me/credentials',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doctor = await prisma.doctorProfile.findUnique({ where: { userId: req.user!.id } });
      if (!doctor) throw new NotFoundError('Doctor profile');
      const credentials = await prisma.doctorCredential.findMany({
        where: { doctorId: doctor.id },
        select: { id: true, fileName: true, fileType: true, fileSizeBytes: true, uploadedAt: true },
        orderBy: { uploadedAt: 'desc' },
      });
      sendSuccess(res, credentials);
    } catch (err) { next(err); }
  },
);
