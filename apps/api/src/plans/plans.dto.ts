import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { IsDateOnly } from '../common/validators';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** ₦1,000,000 per day in kobo; guards against unit mistakes (naira sent as kobo × 100). */
export const MAX_DAILY_AMOUNT_MINOR = 100_000_000;
/** Longest supported plan, in days. */
export const MAX_PLAN_DAYS = 731;

export class CreatePlanDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  /** Daily amount in kobo (₦1,000 = 100000). */
  @IsInt()
  @Min(1)
  @Max(MAX_DAILY_AMOUNT_MINOR)
  dailyAmountMinor: number;

  @IsIn(['NGN'])
  currency: 'NGN';

  @IsIn(['DAILY'])
  frequency: 'DAILY';

  /** YYYY-MM-DD */
  @IsDateOnly()
  startOn: string;

  /** YYYY-MM-DD, on or after startOn. */
  @IsDateOnly()
  endOn: string;
}
