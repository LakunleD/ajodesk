import { IsOptional, IsUUID } from 'class-validator';
import { IsDateOnly } from '../common/validators';

export class CreateEnrollmentDto {
  @IsUUID()
  contributorId: string;

  @IsUUID()
  planId: string;

  /** Defaults to the plan start. Must lie within the plan. */
  @IsOptional()
  @IsDateOnly()
  startOn?: string;

  /** Defaults to the plan end. Must lie within the plan. */
  @IsOptional()
  @IsDateOnly()
  endOn?: string;
}
