import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { SavingsPlan } from './savings-plan.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SavingsPlan]), AuditModule],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
