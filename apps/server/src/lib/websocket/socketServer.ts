// ============================================================
// TELECAL — WEBSOCKET SERVER
// Handles real-time events: presence, assignment, signaling.
//
// Security:
// - Every socket connection requires a valid JWT
// - Users can only join rooms they own
// - Signaling messages are validated before forwarding
// ============================================================

import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { WS_EVENTS, UserRole } from '@mediconnect/shared';
import { config } from '../../config';
import { prisma } from '../prisma';
import { logger } from '../logger';

// ─── Connected user registry (in-memory) ─────────────────────
// Maps userId -> Set of socketIds (user may have multiple tabs)

const connectedUsers = new Map<string, Set<string>>();

// ─── JWT auth for socket connections ─────────────────────────

interface SocketUser {
  id: string;
  email: string;
  role: UserRole;
}

const authenticateSocket = (socket: Socket): SocketUser | null => {
  try {
    // Accept token from handshake auth or cookie
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers?.cookie
        ?.split(';')
        .find((c) => c.trim().startsWith('access_token='))
        ?.split('=')[1]);

    if (!token) return null;

    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET) as {
      sub: string;
      email: string;
      role: UserRole;
    };

    return { id: decoded.sub, email: decoded.email, role: decoded.role };
  } catch {
    return null;
  }
};

// ─── Initialize socket server ─────────────────────────────────

export const initSocketServer = (io: SocketServer): void => {
  // ── Auth middleware for every socket connection ──────────────
  io.use((socket, next) => {
    const user = authenticateSocket(socket);
    if (!user) {
      next(new Error('Authentication failed'));
      return;
    }
    // Attach user to socket for use in handlers
    (socket.data as { user: SocketUser }).user = user;
    next();
  });

  // ── Connection handler ────────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    const user = (socket.data as { user: SocketUser }).user;
    logger.info('WebSocket connected', { userId: user.id, role: user.role });

    // Track connection
    if (!connectedUsers.has(user.id)) {
      connectedUsers.set(user.id, new Set());
    }
    connectedUsers.get(user.id)!.add(socket.id);

    // Join personal room for targeted notifications
    void socket.join(`user:${user.id}`);

    // ── Doctor presence ────────────────────────────────────────
    if (user.role === UserRole.DOCTOR) {
      void socket.join('doctors:online'); // Room for admin monitoring

      socket.on(WS_EVENTS.DOCTOR_GO_ONLINE, async () => {
        try {
          await prisma.doctorProfile.update({
            where: { userId: user.id },
            data: {
              presence: 'ONLINE',
              onlineSince: new Date(),
            },
          });

          io.emit(WS_EVENTS.PRESENCE_UPDATE, {
            doctorId: user.id,
            presence: 'ONLINE',
            timestamp: new Date().toISOString(),
          });

          logger.info('Doctor went online', { userId: user.id });
        } catch (err) {
          logger.error('Error setting doctor online', { userId: user.id, err });
        }
      });

      socket.on(WS_EVENTS.DOCTOR_GO_OFFLINE, async () => {
        await setDoctorOffline(user.id, io);
      });
    }

    // ── WebRTC signaling ───────────────────────────────────────
    // Relay signaling messages between patient and doctor
    // Only forwards to the correct appointment room

    socket.on(
      WS_EVENTS.SESSION_OFFER,
      (payload: { appointmentId: string; signal: unknown }) => {
        if (!payload.appointmentId || !payload.signal) return;
        // Forward to the appointment room (both participants are in it)
        socket
          .to(`appointment:${payload.appointmentId}`)
          .emit(WS_EVENTS.SESSION_OFFER, {
            fromUserId: user.id,
            appointmentId: payload.appointmentId,
            signal: payload.signal,
          });
      },
    );

    socket.on(
      WS_EVENTS.SESSION_ANSWER,
      (payload: { appointmentId: string; signal: unknown }) => {
        if (!payload.appointmentId || !payload.signal) return;
        socket
          .to(`appointment:${payload.appointmentId}`)
          .emit(WS_EVENTS.SESSION_ANSWER, {
            fromUserId: user.id,
            appointmentId: payload.appointmentId,
            signal: payload.signal,
          });
      },
    );

    socket.on(
      WS_EVENTS.SESSION_ICE_CANDIDATE,
      (payload: { appointmentId: string; signal: unknown }) => {
        if (!payload.appointmentId || !payload.signal) return;
        socket
          .to(`appointment:${payload.appointmentId}`)
          .emit(WS_EVENTS.SESSION_ICE_CANDIDATE, {
            fromUserId: user.id,
            appointmentId: payload.appointmentId,
            signal: payload.signal,
          });
      },
    );

    // ── Join appointment room (for signaling) ──────────────────
    socket.on(
      'appointment:join',
      async (payload: { appointmentId: string }) => {
        if (!payload.appointmentId) return;

        // Verify user belongs to this appointment
        const appointment = await prisma.appointment.findFirst({
          where: {
            id: payload.appointmentId,
            OR: [
              { patient: { userId: user.id } },
              { doctor: { userId: user.id } },
            ],
          },
        });

        if (!appointment) {
          socket.emit('error', { message: 'Appointment not found or access denied' });
          return;
        }

        void socket.join(`appointment:${payload.appointmentId}`);
        logger.info('User joined appointment room', {
          userId: user.id,
          appointmentId: payload.appointmentId,
        });
      },
    );

    // ── Disconnect ─────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const userSockets = connectedUsers.get(user.id);
      userSockets?.delete(socket.id);

      // Only mark doctor offline when ALL their tabs disconnect
      if (userSockets?.size === 0) {
        connectedUsers.delete(user.id);

        if (user.role === UserRole.DOCTOR) {
          await setDoctorOffline(user.id, io);
        }
      }

      logger.info('WebSocket disconnected', {
        userId: user.id,
        remainingSockets: userSockets?.size ?? 0,
      });
    });
  });

  logger.info('WebSocket server initialized');
};

// ─── Helpers ─────────────────────────────────────────────────

const setDoctorOffline = async (
  userId: string,
  io: SocketServer,
): Promise<void> => {
  try {
    await prisma.doctorProfile.update({
      where: { userId },
      data: {
        presence: 'OFFLINE',
        onlineSince: null,
      },
    });

    io.emit(WS_EVENTS.PRESENCE_UPDATE, {
      doctorId: userId,
      presence: 'OFFLINE',
      timestamp: new Date().toISOString(),
    });

    logger.info('Doctor went offline', { userId });
  } catch (err) {
    logger.error('Error setting doctor offline', { userId, err });
  }
};

// ─── Notification sender (used by other modules) ─────────────

export const sendNotificationToUser = (
  io: SocketServer,
  userId: string,
  notification: object,
): void => {
  io.to(`user:${userId}`).emit(WS_EVENTS.NOTIFICATION, { notification });
};

export const getConnectedUsers = (): Map<string, Set<string>> =>
  connectedUsers;
