import { loadDotEnv } from '../config/load-env';
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';

/** Boots the Nest container without HTTP so scripts reuse the real services and rules. */
loadDotEnv();

export async function withAppContext<T>(
  fn: (app: INestApplicationContext) => Promise<T>,
): Promise<T> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}
