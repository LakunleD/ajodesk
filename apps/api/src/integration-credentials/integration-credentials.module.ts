import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { IntegrationCredential } from './integration-credential.entity';
import { IntegrationCredentialsService } from './integration-credentials.service';

/** No HTTP controller: keys are issued and revoked through the operator CLI only. */
@Module({
  imports: [TypeOrmModule.forFeature([IntegrationCredential]), AuditModule],
  providers: [IntegrationCredentialsService],
  exports: [IntegrationCredentialsService],
})
export class IntegrationCredentialsModule {}
