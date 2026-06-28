// ============================================================
// TELECAL — SERVER ENTRY POINT
// Boots the HTTP server, attaches Socket.io, registers
// process-level error handlers, and handles graceful shutdown.
// ============================================================

// Load env vars FIRST before any other imports
import 'dotenv/config';

import http from 'http';
import { Server as SocketServer } from 'socket.io';

import { createApp } from './app';
import { config } from './config';
import { logger } from './lib/logger';
import { prisma, disconnectPrisma } from './lib/prisma';
import {
  handleUncaughtException,
  handleUnhandledRejection,
} from './middleware/errorHandler';
import { initSocketServer } from './lib/websocket/socketServer';
import { setNotificationIo } from './modules/notifications/notifications.service';

// ─── Process-level error guards ───────────────────────────────
// Register BEFORE anything else — catch errors during boot

process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);

// ─── Boot sequence ────────────────────────────────────────────

const boot = async () => {
  // 1. Verify database connection
  try {
    await prisma.$connect();
    logger.info('Database connection established');
  } catch (err) {
    logger.error('Failed to connect to database', { err });
    process.exit(1);
  }

  // 2. Create Express app
  const app = createApp();

  // 3. Create HTTP server (needed for Socket.io to share the same port)
  const httpServer = http.createServer(app);

  // 4. Attach Socket.io to the HTTP server
  const io = new SocketServer(httpServer, {
    cors: {
      origin: config.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    // Ping/pong to detect disconnected clients
    pingTimeout: 20000,
    pingInterval: 25000,
    // Limit payload size
    maxHttpBufferSize: 1e6, // 1MB
  });

  // 5. Initialize WebSocket handlers
  initSocketServer(io);
  setNotificationIo(io);

  // Make io accessible to route handlers via app.get('io')
  app.set('io', io);

  // 6. Start listening
  httpServer.listen(config.PORT, () => {
    logger.info(`Telecal server started`, {
      port: config.PORT,
      environment: config.NODE_ENV,
      pid: process.pid,
    });
  });

  // ── Graceful shutdown ────────────────────────────────────────
  // On SIGTERM/SIGINT: stop accepting new connections,
  // finish in-flight requests, close DB connections.

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — starting graceful shutdown`);

    // Stop accepting new connections
    httpServer.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close Socket.io connections
        await new Promise<void>((resolve) => {
          io.close(() => resolve());
        });
        logger.info('WebSocket server closed');

        // Close database connection
        await disconnectPrisma();

        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', { err });
        process.exit(1);
      }
    });

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

boot();
