import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination';
import { IsDateOnly } from '../common/validators';

export const MAX_DATES_PER_CONTRIBUTION = 366;

/** Body shared by `POST /contributions` and `POST /contribution-intents`. */
export class ContributionRequestDto {
  @IsUUID()
  enrollmentId: string;

  /** Unpaid scheduled dates (YYYY-MM-DD) this cash covers; each is one full day. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_DATES_PER_CONTRIBUTION)
  @IsDateOnly({ each: true })
  scheduledDates: string[];

  /** Must equal plan daily amount × number of dates, in kobo. */
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountMinor: number;

  @IsIn(['NGN'])
  currency: 'NGN';

  @IsIn(['CASH'])
  paymentMethod: 'CASH';
}

export class SummaryQueryDto {
  /** YYYY-MM-DD; defaults to today in Africa/Lagos. */
  @IsOptional()
  @IsDateOnly()
  asOf?: string;
}

export class PlanEnrollmentsQueryDto extends PaginationQueryDto {
  /** YYYY-MM-DD; defaults to today in Africa/Lagos. */
  @IsOptional()
  @IsDateOnly()
  asOf?: string;
}
