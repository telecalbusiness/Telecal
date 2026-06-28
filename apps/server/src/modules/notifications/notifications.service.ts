// ============================================================
// TELECAL — NOTIFICATIONS SERVICE
// Creates persistent notification records and pushes
// real-time events via Socket.io.
// ============================================================

import { Server as SocketServer } from 'socket.io';
import { WS_EVENTS } from '@mediconnect/shared';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, string | number | boolean>;
}

// io is set once at boot time via setIo()
let _io: SocketServer | null = null;

export const setNotificationIo = (io: SocketServer): void => {
  _io = io;
};

const createNotification = async (input: CreateNotificationInput) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type as never,
        title: input.title,
        message: input.message,
        metadata: input.metadata !== undefined ? input.metadata : undefined,
      },
    });

    // Push real-time event if socket server is available
    if (_io) {
      _io.to(`user:${input.userId}`).emit(WS_EVENTS.NOTIFICATION, {
        notification,
      });
    }

    return notification;
  } catch (err) {
    logger.error('Failed to create notification', { input, err });
    return null;
  }
};

const markAsRead = async (notificationId: string, userId: string) => {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
};

const markAllAsRead = async (userId: string) => {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
};

const getForUser = async (userId: string, page = 1, pageSize = 20) => {
  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
};

const getUnreadCount = async (userId: string): Promise<number> => {
  return prisma.notification.count({ where: { userId, isRead: false } });
};

export const notificationService = {
  createNotification,
  markAsRead,
  markAllAsRead,
  getForUser,
  getUnreadCount,
};
