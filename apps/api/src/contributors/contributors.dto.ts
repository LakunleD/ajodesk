import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PHONE_PATTERN } from '../auth/auth.dto';
import { PaginationQueryDto } from '../common/pagination';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateContributorDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @IsOptional()
  @Transform(trim)
  @Matches(PHONE_PATTERN, { message: 'phone must be 7-15 digits with an optional leading +' })
  phone?: string;
}

export class SearchContributorsQueryDto extends PaginationQueryDto {
  /** Case-insensitive match on name or phone. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  search?: string;
}
