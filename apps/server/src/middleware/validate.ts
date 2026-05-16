// ============================================================
// TELECAL — REQUEST VALIDATION MIDDLEWARE
// Validates request body, query params, and route params
// against Zod schemas before the handler runs.
// Invalid requests are rejected immediately with clear errors.
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Validates a specific part of the request against a Zod schema.
 * Replaces the request part with the parsed/coerced value.
 */
export const validate = (schema: ZodSchema, part: RequestPart = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const details = (result.error as ZodError).errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request data', details);
      return;
    }

    // Replace with parsed value (allows coercion, e.g. string -> number)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any)[part] = result.data;
    next();
  };
};

export const validateBody = (schema: ZodSchema) => validate(schema, 'body');
export const validateQuery = (schema: ZodSchema) => validate(schema, 'query');
export const validateParams = (schema: ZodSchema) => validate(schema, 'params');
