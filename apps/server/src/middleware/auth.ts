import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@mediconnect/shared';
import { config } from '../config';
import { sendUnauthorized, sendForbidden } from '../utils/response';
import { prisma } from '../lib/prisma';

// ─── Extend Express Request type ─────────────────────────────

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      correlationId?: string;
    }
  }
}

// ─── Token verification ───────────────────────────────────────

interface JwtPayload {
  sub: string;     // user ID
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

// ─── Middleware ───────────────────────────────────────────────

/**
 * Requires a valid JWT access token in the Authorization header
 * or in the httpOnly cookie named 'access_token'.
 * Attaches decoded user to req.user.
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let token: string | undefined;

    // Prefer httpOnly cookie (more secure), fall back to Bearer header
    if (req.cookies?.access_token) {
      token = req.cookies.access_token as string;
    } else {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      sendUnauthorized(res, 'No authentication token provided');
      return;
    }

    // Verify and decode
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, config.JWT_ACCESS_SECRET) as JwtPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        sendUnauthorized(res, 'Authentication token expired');
        return;
      }
      sendUnauthorized(res, 'Invalid authentication token');
      return;
    }

    // Verify user still exists and is active
    // This check prevents tokens from working after account deactivation
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      sendUnauthorized(res, 'Account not found or deactivated');
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
    };

    next();
  } catch (err) {
    next(err);
  }
};

// ─── Role guards ──────────────────────────────────────────────

/**
 * Restricts a route to specific roles.
 * Must be used AFTER requireAuth.
 *
 * Usage: router.get('/admin', requireAuth, requireRole(UserRole.ADMIN), handler)
 */
export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res);
      return;
    }

    if (!roles.includes(req.user.role)) {
      sendForbidden(res, 'You do not have permission to access this resource');
      return;
    }

    next();
  };
};

// Convenience aliases
export const requirePatient = requireRole(UserRole.PATIENT);
export const requireDoctor = requireRole(UserRole.DOCTOR);
export const requireAdmin = requireRole(UserRole.ADMIN);
export const requireDoctorOrAdmin = requireRole(UserRole.DOCTOR, UserRole.ADMIN);

// ─── Correlation ID middleware ────────────────────────────────

/**
 * Attaches a unique correlation ID to every request.
 * Logged with every request for end-to-end traceability.
 */
export const attachCorrelationId = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  req.correlationId =
    (req.headers['x-correlation-id'] as string) ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  next();
};
