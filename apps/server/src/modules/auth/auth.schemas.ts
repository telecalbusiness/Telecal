// ============================================================
// TELECAL — AUTH VALIDATION SCHEMAS
// ============================================================

import { z } from 'zod';
import { DisciplineCategory } from '@mediconnect/shared';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[^A-Za-z0-9]/,
    'Password must contain at least one special character',
  );

export const registerPatientSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: passwordSchema,
  firstName: z.string().min(1).max(50).trim(),
  lastName: z.string().min(1).max(50).trim(),
  phoneNumber: z.string().optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
});

export const registerDoctorSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: passwordSchema,
  firstName: z.string().min(1).max(50).trim(),
  lastName: z.string().min(1).max(50).trim(),
  licenseNumber: z.string().min(3).max(50).trim(),
  discipline: z.nativeEnum(DisciplineCategory),
  specialization: z.string().max(100).optional(),
  yearsOfExperience: z.coerce.number().int().min(0).max(60),
  bio: z.string().max(1000).optional(),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type RegisterPatientDto = z.infer<typeof registerPatientSchema>;
export type RegisterDoctorDto = z.infer<typeof registerDoctorSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
