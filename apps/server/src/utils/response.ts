// ============================================================
// TELECAL — API RESPONSE HELPERS
// ============================================================

import { Response } from 'express';
import type { ApiSuccessResponse, ApiErrorResponse } from '@mediconnect/shared';

// Success

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
): void => {
  const body: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
  };
  res.status(statusCode).json(body);
};

export const sendCreated = <T>(res: Response, data: T, message?: string): void => {
  sendSuccess(res, data, message, 201);
};

//Error

export const sendError = (
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void => {
  const body: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
  };
  res.status(statusCode).json(body);
};

//Common error shortcuts

export const sendBadRequest = (
  res: Response,
  message = 'Bad request',
  details?: unknown,
) => sendError(res, 400, 'BAD_REQUEST', message, details);

export const sendUnauthorized = (
  res: Response,
  message = 'Authentication required',
) => sendError(res, 401, 'UNAUTHORIZED', message);

export const sendForbidden = (
  res: Response,
  message = 'Access denied',
) => sendError(res, 403, 'FORBIDDEN', message);

export const sendNotFound = (
  res: Response,
  message = 'Resource not found',
) => sendError(res, 404, 'NOT_FOUND', message);

export const sendConflict = (
  res: Response,
  message: string,
) => sendError(res, 409, 'CONFLICT', message);

export const sendTooManyRequests = (
  res: Response,
  message = 'Too many requests',
) => sendError(res, 429, 'RATE_LIMITED', message);

export const sendServerError = (
  res: Response,
  message = 'An unexpected error occurred',
) => sendError(res, 500, 'SERVER_ERROR', message);
