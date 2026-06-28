-- Add SYSTEM_ALERT to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SYSTEM_ALERT';
