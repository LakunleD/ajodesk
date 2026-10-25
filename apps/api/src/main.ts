import 'reflect-metadata';
import { loadDotEnv } from './config/load-env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { APP_CONFIG, AppConfig } from './config/configuration';

loadDotEnv();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get<AppConfig>(APP_CONFIG);
  configureApp(app, config);

  if (config.enableDocs) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('AjoDesk API')
        .setDescription(
          'Record-management API for daily thrift collectors. Amounts are integer kobo (NGN); ' +
            'schedule dates are YYYY-MM-DD in Africa/Lagos. Cash records are collector-attested, ' +
            'not bank-verified.',
        )
        .setVersion('1.0')
        .addBearerAuth({
          type: 'http',
          scheme: 'bearer',
          description: 'Collector JWT or integration key',
        })
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs-json' });
  }

  await app.listen(config.port, '0.0.0.0');
  Logger.log(`AjoDesk API listening on port ${config.port}`, 'Bootstrap');
}

void bootstrap();
