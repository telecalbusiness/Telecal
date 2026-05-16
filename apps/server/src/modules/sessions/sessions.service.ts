// ============================================================
// TELECAL — SESSIONS SERVICE
//
// Manages the full video session lifecycle:
//  1. Join session (validates access, opens WebRTC room)
//  2. Start recording (marks session active in DB)
//  3. Enforce time limit (server-side timer per session)
//  4. End session (natural or timed-out)
//  5. Store recording reference encrypted in DB
//
// WebRTC signaling is handled by the WebSocket server.
// This service handles the database and business logic side.
// ============================================================

import { Server as SocketServer } from 'socket.io';
import { SESSION_LIMITS, WS_EVENTS } from '@mediconnect/shared';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { NotFoundError, AuthorizationError, AppError } from '../../utils/errors';
import { encrypt } from '../../utils/encryption';
import { appointmentsService } from '../appointments/appointments.service';
import { notificationService } from '../notifications/notifications.service';
import { auditService } from '../audit/audit.service';

// Active session timers — in-memory, keyed by appointmentId
// In a multi-instance deployment, move this to Redis
const sessionTimers = new Map<string, NodeJS.Timeout>();

// ─── Join session ─────────────────────────────────────────────

export const joinSession = async (
  appointmentId: string,
  userId: string,
) => {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, deletedAt: null },
    include: {
      patient: { include: { user: true } },
      doctor: { include: { user: true } },
    },
  });

  if (!appointment) throw new NotFoundError('Appointment');

  // Verify the requesting user belongs to this appointment
  const isPatient = appointment.patient.userId === userId;
  const isDoctor = appointment.doctor?.userId === userId;

  if (!isPatient && !isDoctor) throw new AuthorizationError();

  // Appointment must be ASSIGNED or IN_SESSION to join
  if (!['ASSIGNED', 'IN_SESSION'].includes(appointment.status)) {
    throw new AppError(
      400,
      'BAD_REQUEST',
      `Cannot join session with status: ${appointment.status}`,
    );
  }

  await auditService.log({
    userId,
    action: 'RECORD_VIEWED',
    resourceType: 'Session',
    resourceId: appointmentId,
    metadata: { role: isPatient ? 'patient' : 'doctor' },
  });

  // Return ICE/TURN server config for WebRTC
  return {
    appointmentId,
    sessionDurationMinutes: appointment.sessionDurationMinutes,
    iceServers: getIceServers(),
    role: isPatient ? 'patient' : 'doctor',
  };
};

// ─── Start session ────────────────────────────────────────────

export const startSession = async (
  appointmentId: string,
  io: SocketServer,
) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { include: { user: { select: { id: true } } } },
      doctor: { include: { user: { select: { id: true } } } },
    },
  });

  if (!appointment) throw new NotFoundError('Appointment');
  if (appointment.status === 'IN_SESSION') return; // Already started

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: 'IN_SESSION',
      sessionStartedAt: new Date(),
      sessionRecordingStatus: 'RECORDING',
    },
  });

  logger.info('Session started', {
    appointmentId,
    durationMinutes: appointment.sessionDurationMinutes,
  });

  // ── Server-side time limit enforcement ────────────────────
  // The client also shows a countdown, but the server is
  // the authority — it ends the session regardless of client state.

  const durationMs = appointment.sessionDurationMinutes * 60 * 1000;
  const warningMs = durationMs - SESSION_LIMITS.WARNING_BEFORE_END_SECONDS * 1000;

  // Send warning before time limit
  const warningTimer = setTimeout(() => {
    io.to(`appointment:${appointmentId}`).emit(WS_EVENTS.SESSION_TIME_WARNING, {
      appointmentId,
      secondsRemaining: SESSION_LIMITS.WARNING_BEFORE_END_SECONDS,
    });
    logger.info('Session time warning sent', { appointmentId });
  }, warningMs);

  // End session at time limit + grace period
  const endTimer = setTimeout(async () => {
    await endSession(appointmentId, io, false);
    logger.info('Session ended by time limit', { appointmentId });
  }, durationMs + SESSION_LIMITS.GRACE_PERIOD_SECONDS * 1000);

  // Store the end timer so it can be cleared if session ends early
  sessionTimers.set(appointmentId, endTimer);

  // Emit session start to both parties
  io.to(`appointment:${appointmentId}`).emit(WS_EVENTS.SESSION_START, {
    appointmentId,
    startedAt: new Date().toISOString(),
    durationMinutes: appointment.sessionDurationMinutes,
    warningAt: SESSION_LIMITS.WARNING_BEFORE_END_SECONDS,
  });

  // Clear warning timer reference (it doesn't need cancellation tracking)
  // but clear end timer on cleanup
  return warningTimer;
};

// ─── End session ──────────────────────────────────────────────

export const endSession = async (
  appointmentId: string,
  io: SocketServer,
  endedNaturally: boolean,
  recordingKey?: string,
) => {
  // Cancel the server-side time limit timer if it exists
  const existingTimer = sessionTimers.get(appointmentId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    sessionTimers.delete(appointmentId);
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { include: { user: { select: { id: true } } } },
      doctor: { include: { user: { select: { id: true } } } },
    },
  });

  if (!appointment) throw new NotFoundError('Appointment');
  if (!['IN_SESSION', 'ASSIGNED'].includes(appointment.status)) return;

  // Encrypt the recording storage key before saving
  const encryptedRecordingKey = recordingKey ? encrypt(recordingKey) : null;

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      sessionEndedAt: new Date(),
      sessionRecordingKey: encryptedRecordingKey,
      sessionRecordingStatus: recordingKey ? 'STORED' : 'FAILED',
    },
  });

  // Mark appointment complete (releases doctor slot, runs queue)
  await appointmentsService.completeAppointment(appointmentId, endedNaturally);

  // Notify both parties the session ended
  io.to(`appointment:${appointmentId}`).emit(WS_EVENTS.SESSION_END, {
    appointmentId,
    endedAt: new Date().toISOString(),
    endedNaturally,
  });

  // Send notifications
  if (appointment.patient?.user?.id) {
    await notificationService.createNotification({
      userId: appointment.patient.user.id,
      type: 'SESSION_ENDED',
      title: 'Session completed',
      message: endedNaturally
        ? 'Your consultation session has ended. You may now upload any investigation reports.'
        : 'Your session has ended — the maximum time limit was reached.',
      metadata: { appointmentId },
    });
  }

  if (appointment.doctor?.user?.id) {
    await notificationService.createNotification({
      userId: appointment.doctor.user.id,
      type: 'SESSION_ENDED',
      title: 'Session completed',
      message: 'Consultation session ended. You can now issue a prescription if needed.',
      metadata: { appointmentId },
    });
  }

  logger.info('Session ended', { appointmentId, endedNaturally });
};

// ─── Get ICE servers for WebRTC ───────────────────────────────

export const getIceServers = () => {
  const servers: object[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  // Add TURN server if configured
  if (process.env['TURN_SERVER_URL']) {
    servers.push({
      urls: process.env['TURN_SERVER_URL'],
      username: process.env['TURN_SERVER_USERNAME'],
      credential: process.env['TURN_SERVER_CREDENTIAL'],
    });
  }

  return servers;
};

export const sessionsService = {
  joinSession,
  startSession,
  endSession,
  getIceServers,
};
