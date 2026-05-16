// ============================================================
// TELECAL — STORAGE SERVICE
// Abstracts file storage behind a single interface.
// Local disk in development, S3 in production.
//
// Files are NEVER served directly from their storage path.
// Access is always via signed, time-limited URLs generated
// server-side, with an audit log entry per access.
// ============================================================

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from './logger';

export interface StoredFile {
  fileKey: string;       // Opaque storage key — never expose to client as URL
  fileName: string;      // Original filename for display
  fileType: string;      // MIME type
  fileSizeBytes: number;
}

// ─── Local storage (development) ─────────────────────────────

const LOCAL_BASE = path.resolve(config.LOCAL_STORAGE_PATH ?? './uploads');

const ensureDir = async (dir: string): Promise<void> => {
  await fs.mkdir(dir, { recursive: true });
};

const saveLocal = async (
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folder: string,
): Promise<StoredFile> => {
  const dir = path.join(LOCAL_BASE, folder);
  await ensureDir(dir);

  // Generate a random key — never use original filename in storage
  const ext = path.extname(originalName).slice(1) || 'bin';
  const fileKey = `${folder}/${crypto.randomUUID()}.${ext}`;
  const fullPath = path.join(LOCAL_BASE, fileKey);

  await fs.writeFile(fullPath, buffer);

  return {
    fileKey,
    fileName: originalName,
    fileType: mimeType,
    fileSizeBytes: buffer.length,
  };
};

// ─── S3 storage (production) ──────────────────────────────────
// This is the interface used in production. Requires:
// AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET

const saveS3 = async (
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folder: string,
): Promise<StoredFile> => {
  // Dynamic import to avoid requiring AWS SDK in dev
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

  const s3 = new S3Client({
    region: config.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY ?? '',
    },
  });

  const ext = path.extname(originalName).slice(1) || 'bin';
  const fileKey = `${folder}/${crypto.randomUUID()}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: config.AWS_S3_BUCKET ?? '',
    Key: fileKey,
    Body: buffer,
    ContentType: mimeType,
    // Server-side encryption
    ServerSideEncryption: 'aws:kms',
    // No public access — all access via signed URLs
    ACL: 'private',
    Metadata: {
      originalName: encodeURIComponent(originalName),
    },
  }));

  return {
    fileKey,
    fileName: originalName,
    fileType: mimeType,
    fileSizeBytes: buffer.length,
  };
};

// ─── Public interface ─────────────────────────────────────────

export const storageService = {
  /**
   * Save a file buffer to storage.
   * Returns a StoredFile with an opaque fileKey — never a public URL.
   */
  async save(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder: 'credentials' | 'investigations' | 'recordings' | 'avatars',
  ): Promise<StoredFile> {
    const isS3 = config.STORAGE_PROVIDER === 's3';
    try {
      if (isS3) {
        return await saveS3(buffer, originalName, mimeType, folder);
      }
      return await saveLocal(buffer, originalName, mimeType, folder);
    } catch (err) {
      logger.error('Storage save failed', { folder, mimeType, err });
      throw new Error('File storage failed');
    }
  },

  /**
   * Delete a file by its storage key.
   * Used when an investigation is cancelled or credentials replaced.
   */
  async delete(fileKey: string): Promise<void> {
    try {
      if (config.STORAGE_PROVIDER === 's3') {
        const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
        const s3 = new S3Client({ region: config.AWS_REGION ?? 'us-east-1' });
        await s3.send(new DeleteObjectCommand({
          Bucket: config.AWS_S3_BUCKET ?? '',
          Key: fileKey,
        }));
      } else {
        const fullPath = path.join(LOCAL_BASE, fileKey);
        await fs.unlink(fullPath);
      }
    } catch (err) {
      // Log but don't throw — deletion failure is not critical
      logger.error('Storage delete failed', { fileKey, err });
    }
  },

  /**
   * Get a readable stream for a file.
   * Used for serving files via the API (admin only).
   * In production, prefer generating a pre-signed S3 URL instead.
   */
  async getBuffer(fileKey: string): Promise<Buffer> {
    if (config.STORAGE_PROVIDER === 's3') {
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({ region: config.AWS_REGION ?? 'us-east-1' });
      const response = await s3.send(new GetObjectCommand({
        Bucket: config.AWS_S3_BUCKET ?? '',
        Key: fileKey,
      }));
      const chunks: Uint8Array[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const chunk of response.Body as any) {
        chunks.push(chunk as Uint8Array);
      }
      return Buffer.concat(chunks);
    }

    const fullPath = path.join(LOCAL_BASE, fileKey);
    return fs.readFile(fullPath);
  },
};
