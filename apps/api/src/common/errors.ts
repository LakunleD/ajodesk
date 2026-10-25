import { HttpStatus } from '@nestjs/common';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'ENROLLMENT_ALREADY_EXISTS'
  | 'IDEMPOTENCY_CONFLICT'
  | 'SCHEDULE_DATE_ALREADY_PAID'
  | 'INTENT_ALREADY_CANCELLED'
  | 'INTENT_EXPIRED'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

/** Domain error with a stable machine-readable code; rendered by AppExceptionFilter. */
export class AppError extends Error {
  constructor(
    readonly status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }

  static validation(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', message, details);
  }

  static notFound(resource: string): AppError {
    return new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', `${resource} not found`);
  }

  static unauthenticated(message = 'Missing or invalid credentials'): AppError {
    return new AppError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', message);
  }

  static forbidden(message = 'Not permitted to perform this operation'): AppError {
    return new AppError(HttpStatus.FORBIDDEN, 'FORBIDDEN', message);
  }

  static conflict(code: ErrorCode, message: string, details?: Record<string, unknown>): AppError {
    return new AppError(HttpStatus.CONFLICT, code, message, details);
  }
}
