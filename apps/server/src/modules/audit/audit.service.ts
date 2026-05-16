// ============================================================
// TELECAL — AUDIT SERVICE
// INSERT-ONLY. Records are never updated or deleted.
// 7-year retention for medical compliance.
// ============================================================

import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

interface AuditLogInput {
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

const log = async (input: AuditLogInput): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action as never,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: input.metadata !== undefined
          ? (input.metadata as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
    });
  } catch (err) {
    // Audit log failures must NEVER crash the main flow
    logger.error('Failed to write audit log', { input, err });
  }
};

export const auditService = { log };