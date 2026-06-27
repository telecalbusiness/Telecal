import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from './logger';

export interface StoredFile {
  fileKey: string; 
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
}

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

const saveS3 = async (
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folder: string,
): Promise<StoredFile> => {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

  const s3 = new S3Client({
    region: config.AWS_REGION ?? 'eu-west-1',
    endpoint: config.AWS_S3_ENDPOINT,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY ?? '',
    },
    forcePathStyle: true,
  });

  const ext = path.extname(originalName).slice(1) || 'bin';
  const fileKey = `${folder}/${crypto.randomUUID()}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: config.AWS_S3_BUCKET ?? '',
    Key: fileKey,
    Body: buffer,
    ContentType: mimeType,
    ServerSideEncryption: 'aws:kms',
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

export const storageService = {
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

  async delete(fileKey: string): Promise<void> {
    try {
      if (config.STORAGE_PROVIDER === 's3') {
        const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
        const s3 = new S3Client({
          region: config.AWS_REGION ?? 'eu-west-1',
          endpoint: config.AWS_S3_ENDPOINT,
          credentials: {
            accessKeyId: config.AWS_ACCESS_KEY_ID ?? '',
            secretAccessKey: config.AWS_SECRET_ACCESS_KEY ?? '',
          },
          forcePathStyle: true,
        });
        await s3.send(new DeleteObjectCommand({
          Bucket: config.AWS_S3_BUCKET ?? '',
          Key: fileKey,
        }));
      } else {
        const fullPath = path.join(LOCAL_BASE, fileKey);
        await fs.unlink(fullPath);
      }
    } catch (err) {
      logger.error('Storage delete failed', { fileKey, err });
    }
  },

  async getBuffer(fileKey: string): Promise<Buffer> {
    if (config.STORAGE_PROVIDER === 's3') {
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({
        region: config.AWS_REGION ?? 'eu-west-1',
        endpoint: config.AWS_S3_ENDPOINT,
        credentials: {
          accessKeyId: config.AWS_ACCESS_KEY_ID ?? '',
          secretAccessKey: config.AWS_SECRET_ACCESS_KEY ?? '',
        },
        forcePathStyle: true,
      });
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
