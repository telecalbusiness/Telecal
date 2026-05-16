// ============================================================
// TELECAL — INVESTIGATIONS SERVICE
// ============================================================

import { FEES } from '@mediconnect/shared';
import { prisma } from '../../lib/prisma';
import { NotFoundError, AuthorizationError, AppError } from '../../utils/errors';
import { assignmentEngine } from '../../lib/queue/assignmentEngine';
import { auditService } from '../audit/audit.service';
import { emailService } from '../../lib/email';
import { logger } from '../../lib/logger';

// ─── Create investigation request ─────────────────────────────

export const createInvestigation = async (
  patientUserId: string,
  appointmentId?: string,
) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId: patientUserId },
  });
  if (!patient) throw new NotFoundError('Patient profile');

  // Determine if this is a returning patient (discounted rate)
  const isReturning = !!appointmentId;

  if (isReturning && appointmentId) {
    // Verify the linked appointment belongs to this patient
    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, patientId: patient.id, status: 'COMPLETED' },
    });
    if (!appt) {
      throw new AppError(400, 'BAD_REQUEST', 'Linked appointment not found or not completed');
    }
  }

  const amountKobo = isReturning
    ? FEES.INVESTIGATION_RETURNING_KOBO
    : FEES.INVESTIGATION_NEW_KOBO;

  const investigation = await prisma.$transaction(async (tx) => {
    const newInvestigation = await tx.investigation.create({
      data: {
        patientId: patient.id,
        appointmentId: appointmentId ?? null,
        isReturningPatient: isReturning,
        status: 'PENDING_PAYMENT',
      },
    });

    const reference = `MC-INV-${newInvestigation.id.slice(0, 8).toUpperCase()}-${Date.now()}`;
    await tx.payment.create({
      data: {
        patientId: patient.id,
        purpose: isReturning ? 'INVESTIGATION_RETURNING' : 'INVESTIGATION_NEW',
        paystackReference: reference,
        amountKobo,
        currency: 'NGN',
        status: 'PENDING',
        investigationId: newInvestigation.id,
      },
    });

    return newInvestigation;
  });

  logger.info('Investigation created', {
    investigationId: investigation.id,
    isReturning,
    amountKobo,
  });

  return investigation;
};

// ─── Upload report files ──────────────────────────────────────

export const addReportFile = async (
  investigationId: string,
  patientUserId: string,
  fileData: {
    fileName: string;
    fileKey: string;
    fileType: string;
    fileSizeBytes: number;
  },
) => {
  const investigation = await prisma.investigation.findFirst({
    where: { id: investigationId },
    include: { patient: true, files: true },
  });

  if (!investigation) throw new NotFoundError('Investigation');
  if (investigation.patient.userId !== patientUserId) throw new AuthorizationError();

  if (investigation.status !== 'PAYMENT_CONFIRMED') {
    throw new AppError(400, 'BAD_REQUEST', 'Payment must be completed before uploading files');
  }

  if (investigation.files.length >= 5) {
    throw new AppError(400, 'BAD_REQUEST', 'Maximum of 5 files per investigation');
  }

  const file = await prisma.investigationFile.create({
    data: { investigationId, ...fileData },
  });

  // Move investigation to REPORT_UPLOADED status
  await prisma.investigation.update({
    where: { id: investigationId },
    data: { status: 'REPORT_UPLOADED' },
  });

  // Trigger assignment engine to assign a doctor to review
  await assignmentEngine.processQueue();

  return file;
};

// ─── Doctor: get assigned investigations ──────────────────────

export const getDoctorInvestigations = async (
  doctorUserId: string,
  page = 1,
  pageSize = 20,
) => {
  const doctor = await prisma.doctorProfile.findUnique({ where: { userId: doctorUserId } });
  if (!doctor) throw new NotFoundError('Doctor profile');

  const where = { assignedDoctorId: doctor.id };
  const [items, total] = await Promise.all([
    prisma.investigation.findMany({
      where,
      include: {
        files: { select: { id: true, fileName: true, fileType: true, uploadedAt: true } },
        patient: {
          select: {
            fileNumber: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.investigation.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
};

// ─── Doctor: submit review ────────────────────────────────────

export const submitReview = async (
  investigationId: string,
  doctorUserId: string,
  notes: string,
) => {
  const doctor = await prisma.doctorProfile.findUnique({ where: { userId: doctorUserId } });
  if (!doctor) throw new NotFoundError('Doctor profile');

  const investigation = await prisma.investigation.findFirst({
    where: { id: investigationId, assignedDoctorId: doctor.id },
    include: { patient: { include: { user: { select: { id: true } } } } },
  });

  if (!investigation) throw new NotFoundError('Investigation');

  await prisma.investigation.update({
    where: { id: investigationId },
    data: {
      status: 'REVIEWED',
      doctorNotes: notes,
      reviewedAt: new Date(),
    },
  });

  // Notify patient by email
  const fullInvestigation = await prisma.investigation.findUnique({
    where: { id: investigationId },
    include: { patient: { include: { user: { select: { email: true, firstName: true } } } } },
  });
  if (fullInvestigation) {
    void emailService.sendInvestigationReviewed({
      patientEmail: fullInvestigation.patient.user.email,
      patientFirstName: fullInvestigation.patient.user.firstName,
      investigationId,
    });
  }

  await auditService.log({
    userId: doctorUserId,
    action: 'RECORD_MODIFIED',
    resourceType: 'Investigation',
    resourceId: investigationId,
  });

  logger.info('Investigation reviewed', { investigationId, doctorId: doctor.id });
};

// ─── Get investigation by ID ──────────────────────────────────

export const getInvestigationById = async (
  investigationId: string,
  userId: string,
  userRole: string,
) => {
  const investigation = await prisma.investigation.findUnique({
    where: { id: investigationId },
    include: {
      files: true,
      patient: { include: { user: { select: { firstName: true, lastName: true } } } },
      doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  });

  if (!investigation) throw new NotFoundError('Investigation');

  const isAdmin = userRole === 'ADMIN';
  const isPatient = investigation.patient.userId === userId;
  const isDoctor = investigation.doctor?.userId === userId;

  if (!isAdmin && !isPatient && !isDoctor) throw new AuthorizationError();

  await auditService.log({
    userId,
    action: 'INVESTIGATION_ACCESSED',
    resourceType: 'Investigation',
    resourceId: investigationId,
  });

  return investigation;
};

export const investigationsService = {
  createInvestigation,
  addReportFile,
  getDoctorInvestigations,
  submitReview,
  getInvestigationById,
};
