// ============================================================
// TELECAL — USERS ROUTES
// Profile management for all user types.
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { sendSuccess } from '../../utils/response';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../utils/errors';
import bcrypt from 'bcryptjs';
import { AUTH } from '@mediconnect/shared';
import { auditService } from '../audit/audit.service';

import { uploadRateLimit } from '../../middleware/rateLimiter';
import { storageService } from '../../lib/storage';
import multer from 'multer';

const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max for avatars
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

export const usersRouter = Router();
usersRouter.use(requireAuth);

// GET /users/me — full profile based on role
usersRouter.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, avatarUrl: true, isEmailVerified: true,
        createdAt: true, updatedAt: true,
        patientProfile: {
          select: {
            id: true, fileNumber: true, dateOfBirth: true,
            gender: true, phoneNumber: true, bloodGroup: true,
            genotype: true, allergies: true,
            emergencyContactName: true, emergencyContactPhone: true,
          },
        },
        doctorProfile: {
          select: {
            id: true, licenseNumber: true, discipline: true,
            specialization: true, yearsOfExperience: true, bio: true,
            status: true, presence: true, onlineSince: true,
            currentPatientCount: true, availabilitySchedule: true,
            createdAt: true, updatedAt: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundError('User');
    sendSuccess(res, user);
  } catch (err) { next(err); }
});

// PATCH /users/me — update basic info (email and phone only — name is permanent)
usersRouter.patch(
  '/me',
  validateBody(z.object({
    email: z.string().email('Enter a valid email').optional(),
    phoneNumber: z.string().max(20).optional(),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, phoneNumber } = req.body as {
        email?: string;
        phoneNumber?: string;
      };

      // Update email if provided — check it is not taken by another user
      if (email) {
        const existing = await prisma.user.findFirst({
          where: { email, NOT: { id: req.user!.id } },
        });
        if (existing) {
          res.status(409).json({
            success: false,
            error: { code: 'CONFLICT', message: 'This email address is already in use' },
          });
          return;
        }
        await prisma.user.update({
          where: { id: req.user!.id },
          data: { email, isEmailVerified: false },
        });
      }

      // Update phone number on patient profile if provided
      if (phoneNumber !== undefined) {
        const userRecord = await prisma.user.findUnique({
          where: { id: req.user!.id },
          select: { role: true },
        });
        if (userRecord?.role === 'PATIENT') {
          await prisma.patientProfile.updateMany({
            where: { userId: req.user!.id },
            data: { phoneNumber },
          });
        }
      }

      await auditService.log({
        userId: req.user!.id,
        action: 'RECORD_MODIFIED',
        resourceType: 'User',
        resourceId: req.user!.id,
        metadata: { fields: Object.keys(req.body as object) },
      });

      sendSuccess(res, null, 'Profile updated successfully');
    } catch (err) { next(err); }
  },
);

// POST /users/me/avatar — upload profile picture
usersRouter.post(
  '/me/avatar',
  uploadRateLimit,
  uploadAvatar.single('avatar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No image file provided' },
        });
        return;
      }

      // Store the image
      const stored = await storageService.save(
        file.buffer,
        file.originalname,
        file.mimetype,
        'avatars',
      );

      // Update user's avatarUrl with the storage key wrapped in our serve path
      const avatarUrl = `/api/v1/users/avatar/${encodeURIComponent(stored.fileKey)}`;
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { avatarUrl },
      });

      sendSuccess(res, { avatarUrl }, 'Profile picture updated');
    } catch (err) { next(err); }
  },
);

// GET /users/avatar/:fileKey — serve avatar image
usersRouter.get(
  '/avatar/:fileKey(*)',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fileKey = decodeURIComponent(req.params['fileKey'] as string);
      const buffer = await storageService.getBuffer(fileKey);

      // Determine content type from file extension
      const ext = fileKey.split('.').pop()?.toLowerCase();
      const contentType =
        ext === 'png' ? 'image/png' :
        ext === 'webp' ? 'image/webp' :
        'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24hr browser cache
      res.send(buffer);
    } catch (err) { next(err); }
  },
);

// PATCH /users/me/password — change password
usersRouter.patch(
  '/me/password',
  validateBody(z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string()
      .min(8)
      .regex(/[A-Z]/)
      .regex(/[a-z]/)
      .regex(/[0-9]/)
      .regex(/[^A-Za-z0-9]/),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { passwordHash: true },
      });
      if (!user) throw new NotFoundError('User');

      const valid = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
      if (!valid) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' },
        });
        return;
      }

      const passwordHash = await bcrypt.hash(req.body.newPassword, AUTH.BCRYPT_ROUNDS);
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { passwordHash },
      });

      // Revoke all refresh tokens — force re-login on all devices
      await prisma.refreshToken.updateMany({
        where: { userId: req.user!.id },
        data: { revokedAt: new Date() },
      });

      await auditService.log({
        userId: req.user!.id,
        action: 'PASSWORD_CHANGED',
      });

      sendSuccess(res, null, 'Password changed. Please log in again.');
    } catch (err) { next(err); }
  },
);

