// ============================================================
// TELECAL — APPOINTMENTS SERVICE
// ============================================================

import {
  ConsultationType,
  FEES,
} from '@mediconnect/shared';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { NotFoundError, AuthorizationError, AppError } from '../../utils/errors';
import { assignmentEngine } from '../../lib/queue/assignmentEngine';
import { auditService } from '../audit/audit.service';
import type { CreateAppointmentDto } from './appointments.schemas';

// ─── Create appointment ───────────────────────────────────────

export const createAppointment = async (
  patientUserId: string,
  dto: CreateAppointmentDto & { useWallet?: boolean },
) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId: patientUserId },
  });
  if (!patient) throw new NotFoundError('Patient profile');

  const amountKobo =
    dto.consultationType === ConsultationType.GENERAL_PRACTICE
      ? FEES.GENERAL_PRACTICE_KOBO
      : FEES.SPECIALIST_KOBO;

  // If paying with wallet, debit immediately and mark as confirmed
  if (dto.useWallet) {
    const { debitWallet } = await import('../wallet/wallet.service');
    await debitWallet(
      patientUserId,
      amountKobo,
      `Consultation: ${dto.consultationType.replace(/_/g, ' ')}`,
    );

    // Create appointment already confirmed
    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        consultationType: dto.consultationType,
        discipline: dto.discipline ?? null,
        priority: dto.priority,
        notes: dto.notes ?? null,
        status: 'PAYMENT_CONFIRMED', // Skip payment step
        sessionDurationMinutes: 0,
      },
    });

    const paystackReference = `TC-WALLET-APT-${appointment.id.slice(0, 8).toUpperCase()}`;
    const payment = await prisma.payment.create({
      data: {
        patientId: patient.id,
        purpose: 'CONSULTATION',
        paystackReference,
        amountKobo,
        currency: 'NGN',
        status: 'SUCCESSFUL',
        appointmentId: appointment.id,
        paidAt: new Date(),
      },
    });

    // Trigger assignment immediately
    const { assignmentEngine } = await import('../../lib/queue/assignmentEngine');
    await assignmentEngine.processQueue();

    return { appointment, payment };
  }

  // Standard Paystack flow
  const { appointment, payment } = await createAppointmentWithPaystack(
    patient, dto, amountKobo,
  );
  return { appointment, payment };
};

// Extract existing transaction logic
const createAppointmentWithPaystack = async (
  patient: { id: string },
  dto: CreateAppointmentDto,
  amountKobo: number,
) => {
  let newAppointment: Awaited<ReturnType<typeof prisma.appointment.create>>;
  let newPayment: Awaited<ReturnType<typeof prisma.payment.create>>;

  await prisma.$transaction(async (tx) => {
    newAppointment = await tx.appointment.create({
      data: {
        patientId: patient.id,
        consultationType: dto.consultationType,
        discipline: dto.discipline ?? null,
        priority: dto.priority,
        notes: dto.notes ?? null,
        status: 'PENDING_PAYMENT',
        sessionDurationMinutes: 0,
      },
    });

    const paystackReference = `TC-APT-${newAppointment.id.slice(0, 8).toUpperCase()}-${Date.now()}`;
    newPayment = await tx.payment.create({
      data: {
        patientId: patient.id,
        purpose: 'CONSULTATION',
        paystackReference,
        amountKobo,
        currency: 'NGN',
        status: 'PENDING',
        appointmentId: newAppointment.id,
      },
    });
  });

  return { appointment: newAppointment!, payment: newPayment! };
};

// ─── Get appointment by ID ────────────────────────────────────

export const getAppointmentById = async (
  appointmentId: string,
  requestingUserId: string,
  requestingUserRole: string,
) => {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, deletedAt: null },
    include: {
      patient: {
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      },
      doctor: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      payment: true,
      prescription: true,
    },
  });

  if (!appointment) throw new NotFoundError('Appointment');

  // Enforce access control — only the patient, assigned doctor, or admin can view
  const isAdmin = requestingUserRole === 'ADMIN';
  const isPatient = appointment.patient.userId === requestingUserId;
  const isAssignedDoctor = appointment.doctor?.userId === requestingUserId;

  if (!isAdmin && !isPatient && !isAssignedDoctor) {
    throw new AuthorizationError();
  }

  await auditService.log({
    userId: requestingUserId,
    action: 'RECORD_VIEWED',
    resourceType: 'Appointment',
    resourceId: appointmentId,
  });

  // Strip sensitive fields for non-admins
  if (!isAdmin) {
    return {
      ...appointment,
      sessionRecordingKey: undefined, // Never expose storage key
      payment: appointment.payment
        ? { ...appointment.payment, gatewayResponseEncrypted: undefined }
        : null,
    };
  }

  return appointment;
};

// ─── List appointments ────────────────────────────────────────

export const listPatientAppointments = async (
  patientUserId: string,
  page: number,
  pageSize: number,
  status?: string,
) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId: patientUserId },
  });
  if (!patient) throw new NotFoundError('Patient profile');

  const where = {
    patientId: patient.id,
    deletedAt: null,
    ...(status ? { status: status as never } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        payment: { select: { status: true, amountKobo: true, paidAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.appointment.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
};

export const listDoctorAppointments = async (
  doctorUserId: string,
  page: number,
  pageSize: number,
  status?: string,
) => {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId: doctorUserId },
  });
  if (!doctor) throw new NotFoundError('Doctor profile');

  const where = {
    doctorId: doctor.id,
    deletedAt: null,
    ...(status ? { status: status as never } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: {
            fileNumber: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        prescription: { select: { status: true, issuedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.appointment.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
};

// ─── Cancel appointment ───────────────────────────────────────

export const cancelAppointment = async (
  appointmentId: string,
  requestingUserId: string,
) => {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, deletedAt: null },
    include: { patient: true, doctor: true },
  });

  if (!appointment) throw new NotFoundError('Appointment');

  const isPatient = appointment.patient.userId === requestingUserId;
  if (!isPatient) throw new AuthorizationError();

  // Cannot cancel once session has started
  if (['IN_SESSION', 'COMPLETED', 'TIMED_OUT'].includes(appointment.status)) {
    throw new AppError(409, 'CONFLICT', 'Cannot cancel an appointment that is in session or completed');
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'CANCELLED' },
  });

  // Release the doctor's slot if one was assigned
  if (appointment.doctorId) {
    await assignmentEngine.releaseDoctor(appointment.doctorId);
  }

  logger.info('Appointment cancelled', { appointmentId, patientUserId: requestingUserId });
};

// ─── Mark appointment complete (called by session service) ────

export const completeAppointment = async (
  appointmentId: string,
  endedNaturally: boolean,
) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { doctor: true },
  });

  if (!appointment) throw new NotFoundError('Appointment');

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: endedNaturally ? 'COMPLETED' : 'TIMED_OUT',
      sessionEndedAt: new Date(),
    },
  });

  // Release doctor's slot
  if (appointment.doctorId) {
    await assignmentEngine.releaseDoctor(appointment.doctorId);
  }

  logger.info('Appointment completed', { appointmentId, endedNaturally });
};

export const appointmentsService = {
  createAppointment,
  getAppointmentById,
  listPatientAppointments,
  listDoctorAppointments,
  cancelAppointment,
  completeAppointment,
};
