// ============================================================
// TELECAL — AUTH CONTROLLER
// Thin HTTP layer. Extracts request data, calls service,
// sets cookies, sends response. No business logic here.
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { sendSuccess, sendCreated } from '../../utils/response';
import { isProd } from '../../config';
import type {
  RegisterPatientDto,
  RegisterDoctorDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './auth.schemas';

// ─── Cookie options ───────────────────────────────────────────

const refreshCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
};

const accessCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  maxAge: 15 * 60 * 1000,
  path: '/',
};

// ─── Handlers ─────────────────────────────────────────────────

export const registerPatient = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const dto = req.body as RegisterPatientDto;
    const tokens = await authService.registerPatient(dto, req.ip);

    res.cookie('access_token', tokens.accessToken, accessCookieOptions);
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions);

    sendCreated(res, { role: 'PATIENT' }, 'Account created successfully');
  } catch (err) {
    next(err);
  }
};

export const registerDoctor = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const dto = req.body as RegisterDoctorDto;
    const tokens = await authService.registerDoctor(dto, req.ip);

    res.cookie('access_token', tokens.accessToken, accessCookieOptions);
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions);

    sendCreated(
      res,
      { role: 'DOCTOR' },
      'Account created. Please upload your credentials and await admin verification.',
    );
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const dto = req.body as LoginDto;
    const tokens = await authService.login(dto, req.ip, req.headers['user-agent']);

    res.cookie('access_token', tokens.accessToken, accessCookieOptions);
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions);

    sendSuccess(res, { role: req.user?.role }, 'Login successful');
  } catch (err) {
    next(err);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Accept from cookie or body
    const rawRefreshToken =
      (req.cookies?.refresh_token as string | undefined) ??
      (req.body?.refreshToken as string | undefined);

    if (!rawRefreshToken) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'No refresh token provided' },
      });
      return;
    }

    const { accessToken } = await authService.refreshAccessToken(rawRefreshToken);

    res.cookie('access_token', accessToken, accessCookieOptions);
    sendSuccess(res, null, 'Token refreshed');
  } catch (err) {
    next(err);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const rawRefreshToken = req.cookies?.refresh_token as string | undefined;
    await authService.logout(req.user!.id, rawRefreshToken);

    // Clear both auth cookies
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });

    sendSuccess(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email } = req.body as ForgotPasswordDto;
    await authService.forgotPassword(email);
    // Always return success to prevent email enumeration
    sendSuccess(
      res,
      null,
      'If an account with that email exists, a reset link has been sent.',
    );
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { token, password } = req.body as ResetPasswordDto;
    await authService.resetPassword(token, password);
    sendSuccess(res, null, 'Password reset successfully. Please log in.');
  } catch (err) {
    next(err);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    sendSuccess(res, req.user);
  } catch (err) {
    next(err);
  }
};
