import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { CollectorView } from '../collectors/collectors.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

export class RegisterDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string;

  /** At least 10 characters. */
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  password: string;

  /** Digits with optional leading +, e.g. +2348000000000. */
  @IsOptional()
  @Transform(trim)
  @Matches(PHONE_PATTERN, { message: 'phone must be 7-15 digits with an optional leading +' })
  phone?: string;
}

export class LoginDto {
  @Transform(trim)
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(200)
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  collector: CollectorView;
}
