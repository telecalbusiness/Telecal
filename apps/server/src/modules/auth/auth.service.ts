// ============================================================
// TELECAL — AUTH SERVICE
// All authentication logic lives here — no business logic
// in controllers.
// ============================================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserRole, AUTH } from '@mediconnect/shared';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import {
  hashToken,
  generateSecureToken,
} from '../../utils/encryption';
import {
  ConflictError,
  AuthenticationError,
  AppError,
} from '../../utils/errors';
import { auditService } from '../audit/audit.service';
import { emailService } from '../../lib/email';
import type {
  RegisterPatientDto,
  RegisterDoctorDto,
  LoginDto,
} from './auth.schemas';

// ─── Token helpers ────────────────────────────────────────────

const signAccessToken = (userId: string, email: string, role: UserRole): string =>
  jwt.sign({ sub: userId, email, role }, config.JWT_ACCESS_SECRET, {
    expiresIn: AUTH.ACCESS_TOKEN_EXPIRY,
    algorithm: 'HS256',
  });

// ─── Patient registration ─────────────────────────────────────

export const registerPatient = async (
  dto: RegisterPatientDto,
  ipAddress?: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
  // Check for existing account
  const existing = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(dto.password, AUTH.BCRYPT_ROUNDS);

  // Generate unique file number: PT-XXXXX
  const fileNumber = await generatePatientFileNumber();

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: UserRole.PATIENT,
      },
    });

    await tx.patientProfile.create({
      data: {
        userId: newUser.id,
        fileNumber,
        phoneNumber: dto.phoneNumber,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        gender: dto.gender,
      },
    });

    return newUser;
  });

  logger.info('Patient registered', { userId: user.id, fileNumber });

  // TODO: Send email verification
  // await emailService.sendVerificationEmail(user.email, user.firstName, token);

  return issueTokens(user.id, user.email, UserRole.PATIENT, ipAddress);
};

// ─── Doctor registration ──────────────────────────────────────

export const registerDoctor = async (
  dto: RegisterDoctorDto,
  ipAddress?: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const existing = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const licenseExists = await prisma.doctorProfile.findUnique({
    where: { licenseNumber: dto.licenseNumber },
  });
  if (licenseExists) {
    throw new ConflictError('A doctor with this license number already exists');
  }

  const passwordHash = await bcrypt.hash(dto.password, AUTH.BCRYPT_ROUNDS);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: UserRole.DOCTOR,
      },
    });

    await tx.doctorProfile.create({
      data: {
        userId: newUser.id,
        licenseNumber: dto.licenseNumber,
        discipline: dto.discipline,
        specialization: dto.specialization,
        yearsOfExperience: dto.yearsOfExperience,
        bio: dto.bio,
        // Status starts as PENDING_VERIFICATION — admin must approve
      },
    });

    return newUser;
  });

  logger.info('Doctor registered — pending verification', { userId: user.id });

  return issueTokens(user.id, user.email, UserRole.DOCTOR, ipAddress);
};

// ─── Login ────────────────────────────────────────────────────

export const login = async (
  dto: LoginDto,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
  // Check lockout before doing any DB queries
  await checkBruteForce(dto.email, ipAddress ?? '');

  const user = await prisma.user.findUnique({
    where: { email: dto.email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      role: true,
      isActive: true,
    },
  });

  // Use constant-time comparison path regardless of user existence
  // to prevent user enumeration attacks
  const dummyHash = '$2a$12$dummyhashtopreventtimingattacks00000000000000000000000';
  const hashToCompare = user?.passwordHash ?? dummyHash;
  const passwordMatch = await bcrypt.compare(dto.password, hashToCompare);

  // Record attempt
  await prisma.loginAttempt.create({
    data: {
      email: dto.email,
      ipAddress: ipAddress ?? '',
      successful: !!user && passwordMatch && (user.isActive ?? false),
    },
  });

  if (!user || !passwordMatch || !user.isActive) {
    await auditService.log({
      action: 'LOGIN_FAILED',
      ipAddress,
      metadata: { email: dto.email },
    });
    // Same error message regardless of which check failed — prevents enumeration
    throw new AuthenticationError('Invalid email or password');
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await auditService.log({
    userId: user.id,
    action: 'LOGIN',
    ipAddress,
    metadata: { userAgent },
  });

  return issueTokens(user.id, user.email, user.role as UserRole, ipAddress, userAgent);
};

// ─── Refresh tokens ───────────────────────────────────────────

export const refreshAccessToken = async (
  rawRefreshToken: string,
): Promise<{ accessToken: string }> => {
  let decoded: { sub: string };
  try {
    decoded = jwt.verify(rawRefreshToken, config.JWT_REFRESH_SECRET) as {
      sub: string;
    };
  } catch {
    throw new AuthenticationError('Invalid or expired refresh token');
  }

  const tokenHash = hashToken(rawRefreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
  });

  if (
    !stored ||
    stored.userId !== decoded.sub ||
    stored.revokedAt !== null ||
    stored.expiresAt < new Date()
  ) {
    // If we find an already-revoked token being used, revoke ALL tokens for this user
    // This indicates a stolen refresh token
    if (stored?.revokedAt !== null) {
      await prisma.refreshToken.updateMany({
        where: { userId: decoded.sub },
        data: { revokedAt: new Date() },
      });
      logger.warn('Revoked refresh token reuse detected — all tokens revoked', {
        userId: decoded.sub,
      });
    }
    throw new AuthenticationError('Invalid or expired refresh token');
  }

  if (!stored.user.isActive) {
    throw new AuthenticationError('Account deactivated');
  }

  const accessToken = signAccessToken(
    stored.user.id,
    stored.user.email,
    stored.user.role as UserRole,
  );

  return { accessToken };
};

// ─── Logout ───────────────────────────────────────────────────

export const logout = async (
  userId: string,
  rawRefreshToken?: string,
): Promise<void> => {
  if (rawRefreshToken) {
    const tokenHash = hashToken(rawRefreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, userId },
      data: { revokedAt: new Date() },
    });
  }

  await auditService.log({ userId, action: 'LOGOUT' });
};

// ─── Forgot / Reset password ──────────────────────────────────

export const forgotPassword = async (email: string): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always return success — don't reveal whether email exists
  if (!user) return;

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + AUTH.PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000,
  );

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  void emailService.sendPasswordReset({
    email: user.email,
    firstName: user.firstName,
    resetToken: rawToken,
  });
  logger.info('Password reset requested', { userId: user.id });
};

export const resetPassword = async (
  rawToken: string,
  newPassword: string,
): Promise<void> => {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.usedAt !== null || record.expiresAt < new Date()) {
    throw new AppError(400, 'INVALID_TOKEN', 'Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(newPassword, AUTH.BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Revoke all refresh tokens on password change
    prisma.refreshToken.updateMany({
      where: { userId: record.userId },
      data: { revokedAt: new Date() },
    }),
  ]);

  await auditService.log({
    userId: record.userId,
    action: 'PASSWORD_CHANGED',
  });
};

// ─── Internal helpers ─────────────────────────────────────────

const issueTokens = async (
  userId: string,
  email: string,
  role: UserRole,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const accessToken = signAccessToken(userId, email, role);
  const rawRefreshToken = generateSecureToken();
  const tokenHash = hashToken(rawRefreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      userAgent,
      ipAddress,
      expiresAt,
    },
  });

  return { accessToken, refreshToken: rawRefreshToken };
};

const generatePatientFileNumber = async (): Promise<string> => {
  // Try up to 10 times to get a unique file number
  for (let i = 0; i < 10; i++) {
    const number = Math.floor(Math.random() * 99999)
      .toString()
      .padStart(5, '0');
    const fileNumber = `${AUTH.FILE_NUMBER_PREFIX}-${number}`;
    const exists = await prisma.patientProfile.findUnique({
      where: { fileNumber },
    });
    if (!exists) return fileNumber;
  }
  // Fallback to UUID-based if random exhausted
  return `${AUTH.FILE_NUMBER_PREFIX}-${uuidv4().slice(0, 8).toUpperCase()}`;
};

const checkBruteForce = async (
  email: string,
  ipAddress: string,
): Promise<void> => {
  const windowStart = new Date(
    Date.now() - AUTH.LOCKOUT_DURATION_MINUTES * 60 * 1000,
  );

  const recentFailures = await prisma.loginAttempt.count({
    where: {
      OR: [{ email }, { ipAddress }],
      successful: false,
      attemptedAt: { gte: windowStart },
    },
  });

  if (recentFailures >= AUTH.MAX_LOGIN_ATTEMPTS) {
    throw new AppError(
      429,
      'ACCOUNT_LOCKED',
      `Too many failed attempts. Please try again in ${AUTH.LOCKOUT_DURATION_MINUTES} minutes.`,
    );
  }
};

export const authService = {
  registerPatient,
  registerDoctor,
  login,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
};
