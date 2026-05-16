import { Router } from 'express';
import * as authController from './auth.controller';
import { validateBody } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import {
  authRateLimit,
  passwordResetRateLimit,
} from '../../middleware/rateLimiter';
import {
  registerPatientSchema,
  registerDoctorSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schemas';

export const authRouter = Router();

// Public routes — strict rate limiting
authRouter.post(
  '/register/patient',
  authRateLimit,
  validateBody(registerPatientSchema),
  authController.registerPatient,
);

authRouter.post(
  '/register/doctor',
  authRateLimit,
  validateBody(registerDoctorSchema),
  authController.registerDoctor,
);

authRouter.post(
  '/login',
  authRateLimit,
  validateBody(loginSchema),
  authController.login,
);

authRouter.post('/refresh', authController.refresh);

authRouter.post(
  '/forgot-password',
  passwordResetRateLimit,
  validateBody(forgotPasswordSchema),
  authController.forgotPassword,
);

authRouter.post(
  '/reset-password',
  validateBody(resetPasswordSchema),
  authController.resetPassword,
);

// Protected routes
authRouter.post('/logout', requireAuth, authController.logout);
authRouter.get('/me', requireAuth, authController.getMe);
