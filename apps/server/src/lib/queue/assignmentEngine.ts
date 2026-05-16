// ============================================================
// TELECAL — ASSIGNMENT ENGINE
// ============================================================

import { Server as SocketServer } from 'socket.io';
import {
  ConsultationType,
  DisciplineCategory,
  ASSIGNMENT,
  WS_EVENTS,
  SESSION_LIMITS,
} from '@mediconnect/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { notificationService } from '../../modules/notifications/notifications.service';
import { emailService } from '../email';

// ─── Types ───────────────────────────────────────────────────

interface AssignmentResult {
  success: boolean;
  doctorId?: string;
  message?: string;
}

interface QueuedAppointment {
  id: string;
  patientId: string;
  consultationType: ConsultationType;
  discipline: DisciplineCategory | null;
  priority: string;
  createdAt: Date;
}

type PrismaTx = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// ─── Engine class ─────────────────────────────────────────────

class AssignmentEngine {
  private io: SocketServer | null = null;
  private isProcessing = false;

  setSocketServer(io: SocketServer): void {
    this.io = io;
    logger.info('Assignment engine: socket server attached');
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const waitingAppointments = await prisma.appointment.findMany({
        where: { status: 'PAYMENT_CONFIRMED' },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
      });

      if (waitingAppointments.length === 0) return;

      logger.info(`Assignment engine: processing ${waitingAppointments.length} queued appointment(s)`);

      for (const appointment of waitingAppointments) {
        await this.assignAppointment(appointment as QueuedAppointment);
      }
    } catch (err) {
      logger.error('Assignment engine error during queue processing', { err });
    } finally {
      this.isProcessing = false;
    }
  }

  async assignAppointment(appointment: QueuedAppointment): Promise<AssignmentResult> {
    try {
      // Use a single transaction — no nesting
      let assignmentResult: AssignmentResult = { success: false, message: 'No available doctors' };

      await prisma.$transaction(async (tx: PrismaTx) => {
        const availableDoctor = await this.findBestDoctor(
          tx,
          appointment.consultationType,
          appointment.discipline,
        );

        if (!availableDoctor) {
          return;
        }

        const sessionDuration =
          appointment.consultationType === ConsultationType.GENERAL_PRACTICE
            ? SESSION_LIMITS.GENERAL_PRACTICE_MINUTES
            : SESSION_LIMITS.SPECIALIST_MINUTES;

        await tx.appointment.update({
          where: { id: appointment.id },
          data: {
            doctorId: availableDoctor.id,
            status: 'ASSIGNED',
            assignedAt: new Date(),
            sessionDurationMinutes: sessionDuration,
          },
        });

        await tx.doctorProfile.update({
          where: { id: availableDoctor.id },
          data: {
            currentPatientCount: { increment: 1 },
            presence:
              availableDoctor.currentPatientCount + 1 >= ASSIGNMENT.MAX_PATIENTS_PER_DOCTOR
                ? 'BUSY'
                : 'ONLINE',
          },
        });

        // Set result inside the transaction so it reflects the actual outcome
        assignmentResult = { success: true, doctorId: availableDoctor.id };
      });

      // Now use assignmentResult after the transaction resolves
      if (assignmentResult.success && assignmentResult.doctorId) {
        await this.onAssignmentSuccess(appointment, assignmentResult.doctorId);
      }

      return assignmentResult;

    } catch (err) {
      logger.error('Failed to assign appointment', {
        appointmentId: appointment.id,
        err,
      });
      return { success: false, message: 'Assignment failed' };
    }
  }

  private async findBestDoctor(
    tx: PrismaTx,
    consultationType: ConsultationType,
    discipline: DisciplineCategory | null,
  ) {
    const disciplineFilter: Prisma.DoctorProfileWhereInput =
      consultationType === ConsultationType.SPECIALIST && discipline
        ? { discipline: discipline }
        : consultationType === ConsultationType.GENERAL_PRACTICE
        ? { discipline: DisciplineCategory.GENERAL_PRACTICE }
        : {};

    const doctors = await tx.doctorProfile.findMany({
      where: {
        presence: 'ONLINE',
        status: 'VERIFIED',
        currentPatientCount: { lt: ASSIGNMENT.MAX_PATIENTS_PER_DOCTOR },
        ...disciplineFilter,
      },
      orderBy: [
        { currentPatientCount: 'asc' },
        { onlineSince: 'asc' },
      ],
      take: 1,
    });

    return doctors[0] ?? null;
  }

  private async onAssignmentSuccess(
    appointment: QueuedAppointment,
    doctorId: string,
  ): Promise<void> {
    try {
      const doctor = await prisma.doctorProfile.findUnique({
        where: { id: doctorId },
        include: { user: { select: { id: true, firstName: true, email: true } } },
      });

      const patient = await prisma.patientProfile.findUnique({
        where: { id: appointment.patientId },
        include: {
          user: { select: { id: true, firstName: true, email: true } },
          // fileNumber is a direct field on patientProfile, not user
        },
      });

      if (!doctor || !patient) return;

      if (this.io) {
        this.io.to(`user:${doctor.user.id}`).emit(WS_EVENTS.DOCTOR_ASSIGNED, {
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId,
          consultationType: appointment.consultationType,
          assignedAt: new Date().toISOString(),
        });

        this.io.to(`user:${patient.user.id}`).emit(WS_EVENTS.DOCTOR_ASSIGNED, {
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId,
          consultationType: appointment.consultationType,
          assignedAt: new Date().toISOString(),
        });
      }

      await notificationService.createNotification({
        userId: doctor.user.id,
        type: 'APPOINTMENT_ASSIGNED',
        title: 'New patient assigned',
        message: `Patient ${patient.user.firstName} has been assigned to you. Please prepare for your session.`,
        metadata: { appointmentId: appointment.id },
      });

      await notificationService.createNotification({
        userId: patient.user.id,
        type: 'APPOINTMENT_ASSIGNED',
        title: 'Doctor assigned',
        message: `Dr. ${doctor.user.firstName} has been assigned to your consultation. You will be connected shortly.`,
        metadata: { appointmentId: appointment.id },
      });

      void emailService.sendDoctorAssigned({
        doctorEmail: doctor.user.email,
        doctorFirstName: doctor.user.firstName,
        patientFirstName: patient.user.firstName,
        patientFileNumber: patient.fileNumber,
        consultationType: appointment.consultationType,
        appointmentId: appointment.id,
      });

      void emailService.sendPatientAssigned({
        patientEmail: patient.user.email,
        patientFirstName: patient.user.firstName,
        doctorFirstName: doctor.user.firstName,
        doctorDiscipline: doctor.discipline,
        appointmentId: appointment.id,
      });

      logger.info('Assignment completed', {
        appointmentId: appointment.id,
        doctorId,
        patientId: appointment.patientId,
      });
    } catch (err) {
      logger.error('Post-assignment notification error', { err });
    }
  }

  async releaseDoctor(doctorId: string): Promise<void> {
    await prisma.doctorProfile.update({
      where: { id: doctorId },
      data: {
        currentPatientCount: { decrement: 1 },
        presence: 'ONLINE',
      },
    });

    await this.processQueue();
  }

  startPeriodicSweep(): NodeJS.Timeout {
    const interval = setInterval(async () => {
      await this.processQueue();
    }, ASSIGNMENT.QUEUE_CHECK_INTERVAL_MS);

    logger.info('Assignment engine: periodic sweep started', {
      intervalMs: ASSIGNMENT.QUEUE_CHECK_INTERVAL_MS,
    });

    return interval;
  }
}

export const assignmentEngine = new AssignmentEngine();