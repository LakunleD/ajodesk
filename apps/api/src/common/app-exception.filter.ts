import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { isDatabaseUnavailable } from './db-errors';
import { AppError, ErrorCode } from './errors';
import type { RequestWithId } from './request-id.middleware';

interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string | undefined;
    details?: Record<string, unknown>;
  };
}

const STATUS_CODES: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

/** Renders every error as `{ error: { code, message, requestId } }`; never leaks SQL or stacks. */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<RequestWithId>();
    const res = http.getResponse<Response>();
    const requestId = req.requestId;

    let status: number;
    let body: ErrorBody['error'];

    if (exception instanceof AppError) {
      status = exception.status;
      body = { code: exception.code, message: exception.message, requestId };
      if (exception.details) body.details = exception.details;
    } else if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      body = { code: 'RATE_LIMITED', message: 'Too many requests, retry later', requestId };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const code = STATUS_CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR');
      const message =
        status === 404 ? 'Route not found' : status >= 500 ? 'Internal error' : exception.message;
      body = { code, message, requestId };
    } else if (isDatabaseUnavailable(exception)) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      body = {
        code: 'SERVICE_UNAVAILABLE',
        message:
          'A dependency is unavailable; no changes were confirmed. Retry with the same Idempotency-Key.',
        requestId,
      };
      this.logger.error(`rid=${requestId} database unavailable: ${(exception as Error).message}`);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      body = { code: 'INTERNAL_ERROR', message: 'Internal error', requestId };
      const err = exception as Error;
      this.logger.error(`rid=${requestId} unhandled: ${err?.message}`, err?.stack);
    }

    res.status(status).json({ error: body } satisfies ErrorBody);
  }
}
