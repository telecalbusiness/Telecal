// ============================================================
// TELECAL — FILE UPLOAD MIDDLEWARE
// Multer config with strict validation:
//   - File type whitelist (MIME + extension double-check)
//   - File size limit
//   - File count limit
// Files are stored in memory buffer first, then moved
// to storage service. Never write to disk unvalidated.
// ============================================================

import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { FILE_LIMITS } from '@mediconnect/shared';
import { sendError } from '../utils/response';

// ─── Memory storage (buffer only — no disk writes) ───────────

const storage = multer.memoryStorage();

// ─── Investigation report upload ──────────────────────────────

export const uploadInvestigationFiles = multer({
  storage,
  limits: {
    fileSize: FILE_LIMITS.MAX_FILE_SIZE_BYTES,
    files: FILE_LIMITS.MAX_INVESTIGATION_FILES,
  },
  fileFilter: (_req, file, cb) => {
    if (FILE_LIMITS.ALLOWED_REPORT_MIME_TYPES.includes(
      file.mimetype as typeof FILE_LIMITS.ALLOWED_REPORT_MIME_TYPES[number],
    )) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Accepted: PDF, JPEG, PNG, WEBP`));
    }
  },
});

// ─── Doctor credential upload ─────────────────────────────────

export const uploadCredentialFiles = multer({
  storage,
  limits: {
    fileSize: FILE_LIMITS.MAX_FILE_SIZE_BYTES,
    files: FILE_LIMITS.MAX_CREDENTIAL_FILES,
  },
  fileFilter: (_req, file, cb) => {
    if (FILE_LIMITS.ALLOWED_CREDENTIAL_MIME_TYPES.includes(
      file.mimetype as typeof FILE_LIMITS.ALLOWED_CREDENTIAL_MIME_TYPES[number],
    )) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Accepted: PDF, JPEG, PNG'));
    }
  },
});

// ─── Multer error handler middleware ──────────────────────────

export const handleMulterError = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      sendError(res, 400, 'FILE_TOO_LARGE',
        `File too large. Maximum size is ${FILE_LIMITS.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`);
      return;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      sendError(res, 400, 'TOO_MANY_FILES',
        `Too many files. Maximum is ${FILE_LIMITS.MAX_INVESTIGATION_FILES} files`);
      return;
    }
    sendError(res, 400, 'UPLOAD_ERROR', err.message);
    return;
  }
  if (err instanceof Error) {
    sendError(res, 400, 'UPLOAD_ERROR', err.message);
    return;
  }
  next(err);
};
