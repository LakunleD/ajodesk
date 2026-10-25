import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CollectorsModule } from './collectors/collectors.module';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { ConfigModule } from './config/config.module';
import { APP_CONFIG, AppConfig } from './config/configuration';
import { ContributionIntentsModule } from './contribution-intents/contribution-intents.module';
import { ContributionsModule } from './contributions/contributions.module';
import { ContributorsModule } from './contributors/contributors.module';
import { buildDataSourceOptions } from './database/typeorm-options';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { HealthModule } from './health/health.module';
import { IntegrationCredentialsModule } from './integration-credentials/integration-credentials.module';
import { PlansModule } from './plans/plans.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => buildDataSourceOptions(config.databaseUrl),
    }),
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => [{ ttl: 60_000, limit: config.authRateLimit }],
    }),
    AuditModule,
    AuthModule,
    CollectorsModule,
    ContributorsModule,
    PlansModule,
    EnrollmentsModule,
    ContributionsModule,
    ContributionIntentsModule,
    IntegrationCredentialsModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
