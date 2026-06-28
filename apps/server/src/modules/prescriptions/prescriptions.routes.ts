import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireDoctor } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { sendSuccess, sendCreated } from '../../utils/response';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../utils/errors';
import { z } from 'zod';
import { emailService } from '../../lib/email';
import { notificationService } from '../notifications/notifications.service';

export const prescriptionsRouter = Router();
prescriptionsRouter.use(requireAuth);

const medicationSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  duration: z.string().min(1),
  instructions: z.string().optional(),
});

const createPrescriptionSchema = z.object({
  appointmentId: z.string().uuid(),
  medications: z.array(medicationSchema).min(1).max(20),
  notes: z.string().max(1000).optional(),
  isSensitive: z.boolean().default(false),
});

// Doctor: create prescription
prescriptionsRouter.post(
  '/',
  requireDoctor,
  validateBody(createPrescriptionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doctor = await prisma.doctorProfile.findUnique({ where: { userId: req.user!.id } });
      if (!doctor) throw new NotFoundError('Doctor profile');

      const appt = await prisma.appointment.findFirst({
        where: { id: req.body.appointmentId, doctorId: doctor.id },
        include: { patient: true },
      });
      if (!appt) throw new NotFoundError('Appointment');

      const prescription = await prisma.prescription.create({
        data: {
          appointmentId: appt.id,
          doctorId: doctor.id,
          patientId: appt.patientId,
          medications: req.body.medications,
          notes: req.body.notes ?? null,
          isSensitive: req.body.isSensitive ?? false,
          status: 'DRAFT',
        },
      });
      sendCreated(res, prescription, 'Prescription created');
    } catch (err) { next(err); }
  },
);

// Doctor: issue (finalize) prescription
prescriptionsRouter.patch(
  '/:id/issue',
  requireDoctor,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doctor = await prisma.doctorProfile.findUnique({
        where: { userId: req.user!.id },
        include: { user: { select: { firstName: true } } },
      });
      if (!doctor) throw new NotFoundError('Doctor profile');

      const prescription = await prisma.prescription.findFirst({
        where: { id: req.params['id']!, doctorId: doctor.id },
        include: {
          appointment: {
            include: {
              patient: { include: { user: { select: { email: true, firstName: true } } } },
            },
          },
        },
      });
      if (!prescription) throw new NotFoundError('Prescription');

      const visibleUntil = prescription.isSensitive
        ? null
        : new Date(Date.now() + 24 * 60 * 60 * 1000);

      const updated = await prisma.prescription.update({
        where: { id: prescription.id },
        data: {
          status: 'ISSUED',
          issuedAt: new Date(),
          visibleUntil,
        },
      });

      const meds = prescription.medications as Array<{ name: string }>;
      void emailService.sendPrescriptionIssued({
        patientEmail: prescription.appointment.patient.user.email,
        patientFirstName: prescription.appointment.patient.user.firstName,
        doctorFirstName: doctor.user.firstName,
        appointmentId: prescription.appointmentId,
        medicationCount: meds.length,
      });

      void notificationService.createNotification({
        userId: prescription.appointment.patient.userId,
        type: 'PRESCRIPTION_READY',
        title: 'Prescription issued',
        message: `Dr. ${doctor.user.firstName} has issued a prescription for your consultation with ${meds.length} medication${meds.length > 1 ? 's' : ''}.`,
        metadata: { appointmentId: prescription.appointmentId, prescriptionId: prescription.id },
      });

      sendSuccess(res, updated, 'Prescription issued');
    } catch (err) { next(err); }
  },
);

// Patient: get their prescriptions
prescriptionsRouter.get(
  '/mine',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patient = await prisma.patientProfile.findUnique({
        where: { userId: req.user!.id },
      });
      if (!patient) throw new NotFoundError('Patient profile');

      const now = new Date();
      const prescriptions = await prisma.prescription.findMany({
        where: {
          patientId: patient.id,
          status: 'ISSUED',
          isSensitive: false,
          visibleUntil: { gt: now },
        },
        include: {
          doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { issuedAt: 'desc' },
      });

      sendSuccess(res, prescriptions);
    } catch (err) { next(err); }
  },
);

/// Doctor: get prescriptions they have issued
prescriptionsRouter.get(
  '/issued',
  requireDoctor,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doctor = await prisma.doctorProfile.findUnique({
        where: { userId: req.user!.id },
      });
      if (!doctor) throw new NotFoundError('Doctor profile');

      const prescriptions = await prisma.prescription.findMany({
        where: { doctorId: doctor.id },
        include: {
          appointment: {
            select: {
              consultationType: true,
              patient: {
                select: {
                  fileNumber: true,
                  user: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      sendSuccess(res, prescriptions);
    } catch (err) { next(err); }
  },
);