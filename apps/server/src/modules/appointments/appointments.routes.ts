import { NextFunction, Router, Request, Response, } from 'express';
import { z } from 'zod';
import { requireAuth, requirePatient } from '../../middleware/auth';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate';
import * as controller from './appointments.controller';
import {
  createAppointmentSchema,
  appointmentParamsSchema,
  listAppointmentsQuerySchema,
} from './appointments.schemas';
import { prisma } from '../../lib/prisma';
import { sendSuccess } from '../../utils/response';

export const appointmentsRouter = Router();

appointmentsRouter.use(requireAuth);

// Patient: create new appointment
appointmentsRouter.post(
  '/',
  requirePatient,
  validateBody(createAppointmentSchema),
  controller.create,
);

// Patient or Doctor: list own appointments
appointmentsRouter.get(
  '/',
  validateQuery(listAppointmentsQuerySchema),
  controller.listMine,
);

// Any authenticated user: get single appointment (access enforced in service)
appointmentsRouter.get(
  '/:id',
  validateParams(appointmentParamsSchema),
  controller.getById,
);

// Patient: cancel appointment
appointmentsRouter.patch(
  '/:id/cancel',
  requirePatient,
  validateParams(appointmentParamsSchema),
  controller.cancel,
);

// Patient: submit review after completed appointment
appointmentsRouter.post(
  '/:id/review',
  requirePatient,
  validateParams(appointmentParamsSchema),
  validateBody(z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(500).optional(),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patient = await prisma.patientProfile.findUnique({
        where: { userId: req.user!.id },
      });
      if (!patient) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Patient not found' } });
        return;
      }

      const appointment = await prisma.appointment.findFirst({
        where: {
          id: req.params['id']!,
          patientId: patient.id,
          status: 'COMPLETED',
          deletedAt: null,
        },
      });

      if (!appointment) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Completed appointment not found' },
        });
        return;
      }

      if (!appointment.doctorId) {
        res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'No doctor assigned to this appointment' },
        });
        return;
      }

      // Check if review already exists
      const existing = await prisma.appointmentReview.findUnique({
        where: { appointmentId: appointment.id },
      });

      if (existing) {
        res.status(409).json({
          success: false,
          error: { code: 'CONFLICT', message: 'You have already reviewed this appointment' },
        });
        return;
      }

      const review = await prisma.$transaction(async (tx) => {
        const newReview = await tx.appointmentReview.create({
          data: {
            appointmentId: appointment.id,
            patientId: patient.id,
            doctorId: appointment.doctorId!,
            rating: req.body.rating as number,
            comment: req.body.comment as string | undefined ?? null,
          },
        });

        // Recalculate doctor's average rating from reviews
        const agg = await tx.appointmentReview.aggregate({
          where: { doctorId: appointment.doctorId! },
          _avg: { rating: true },
          _count: { rating: true },
        });

        await tx.doctorProfile.update({
          where: { id: appointment.doctorId! },
          data: {
            averageRating: agg._avg.rating,
            totalRatings: agg._count.rating,
          },
        });

        return newReview;
      });

      sendSuccess(res, review, 'Thank you for your feedback');
    } catch (err) { next(err); }
  },
);

// Patient: check if they have already reviewed an appointment
appointmentsRouter.get(
  '/:id/review',
  requirePatient,
  validateParams(appointmentParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patient = await prisma.patientProfile.findUnique({
        where: { userId: req.user!.id },
      });
      if (!patient) {
        sendSuccess(res, { hasReview: false, review: null });
        return;
      }

      const review = await prisma.appointmentReview.findFirst({
        where: {
          appointmentId: req.params['id']!,
          patientId: patient.id,
        },
      });

      sendSuccess(res, { hasReview: !!review, review });
    } catch (err) { next(err); }
  },
);

