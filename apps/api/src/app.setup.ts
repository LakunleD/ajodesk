import { INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppExceptionFilter } from './common/app-exception.filter';
import { AppError } from './common/errors';
import type { AppConfig } from './config/configuration';

function flattenErrors(errors: ValidationError[], parent = ''): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) out[path] = Object.values(error.constraints);
    if (error.children?.length) Object.assign(out, flattenErrors(error.children, path));
  }
  return out;
}

/** Shared by main.ts and e2e tests so both run the same pipeline. */
export function configureApp(app: INestApplication, config: AppConfig): void {
  const express = app as NestExpressApplication;
  express.disable('x-powered-by');
  if (config.trustProxy) express.set('trust proxy', 1);
  express.useBodyParser('json', { limit: '100kb' });

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Idempotent-Replayed'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        AppError.validation('Request validation failed', { fields: flattenErrors(errors) }),
    }),
  );
  app.useGlobalFilters(new AppExceptionFilter());
  app.enableShutdownHooks();
}
