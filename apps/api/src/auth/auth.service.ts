import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { Collector } from '../collectors/collector.entity';
import { CollectorsService, normalizeEmail } from '../collectors/collectors.service';
import { uniqueViolation } from '../common/db-errors';
import { AppError } from '../common/errors';
import { APP_CONFIG, AppConfig } from '../config/configuration';
import type { AuthResponse, LoginDto, RegisterDto } from './auth.dto';
import type { CollectorJwtPayload } from './auth.guard';

@Injectable()
export class AuthService {
  /** Verified against when the email is unknown so response timing does not reveal accounts. */
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly dataSource: DataSource,
    private readonly collectors: CollectorsService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  static hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await AuthService.hashPassword(dto.password);
    try {
      const collector = await this.dataSource.transaction(async (manager) => {
        const created = await manager.save(
          manager.create(Collector, {
            fullName: dto.fullName,
            email: normalizeEmail(dto.email),
            phone: dto.phone ?? null,
            passwordHash,
            status: 'ACTIVE',
          }),
        );
        await this.audit.record(manager, {
          collectorId: created.id,
          actorType: 'COLLECTOR',
          actorId: created.id,
          action: 'collector.registered',
          entityType: 'collector',
          entityId: created.id,
          metadata: {},
        });
        return created;
      });
      return this.issueToken(collector);
    } catch (error) {
      if (uniqueViolation(error) === 'uq_collectors_email') {
        throw new AppError(
          HttpStatus.CONFLICT,
          'EMAIL_ALREADY_REGISTERED',
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const collector = await this.collectors.findByEmailWithPassword(dto.email);
    if (!collector) {
      this.dummyHash ??= AuthService.hashPassword('not-a-real-password');
      await argon2.verify(await this.dummyHash, dto.password);
      throw AppError.unauthenticated('Invalid email or password');
    }
    const valid = await argon2.verify(collector.passwordHash, dto.password);
    if (!valid || collector.status !== 'ACTIVE') {
      throw AppError.unauthenticated('Invalid email or password');
    }
    return this.issueToken(collector);
  }

  private async issueToken(collector: Collector): Promise<AuthResponse> {
    const payload: CollectorJwtPayload = { sub: collector.id, typ: 'collector' };
    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.config.jwtExpiresInSeconds,
      collector: CollectorsService.toView(collector),
    };
  }
}
