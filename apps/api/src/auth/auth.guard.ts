import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { CollectorsService } from '../collectors/collectors.service';
import { AppError } from '../common/errors';
import {
  IntegrationCredentialsService,
  KEY_PREFIX,
} from '../integration-credentials/integration-credentials.service';
import { hasScopes, Scope, SCOPES } from '../integration-credentials/scopes';
import { COLLECTOR_ONLY, IS_PUBLIC, REQUIRED_SCOPES } from './decorators';
import type { AuthenticatedRequest, Principal } from './principal';

export interface CollectorJwtPayload {
  sub: string;
  typ: 'collector';
}

/**
 * Global guard. Resolves the Bearer token to a Principal (collector JWT or integration key)
 * and enforces route metadata. Integration keys are denied on routes that declare no scopes.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly collectors: CollectorsService,
    private readonly credentials: IntegrationCredentialsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.bearerToken(req);
    const principal = token.startsWith(KEY_PREFIX)
      ? await this.fromIntegrationKey(token)
      : await this.fromCollectorJwt(token);
    req.principal = principal;

    if (principal.actorType === 'COLLECTOR') return true;

    if (this.reflector.getAllAndOverride<boolean>(COLLECTOR_ONLY, targets)) {
      throw AppError.forbidden('This operation requires a collector session');
    }
    const required = this.reflector.getAllAndOverride<Scope[] | undefined>(
      REQUIRED_SCOPES,
      targets,
    );
    if (!required || required.length === 0) {
      throw AppError.forbidden('This operation is not available to integration credentials');
    }
    if (!hasScopes(principal.scopes, required)) {
      throw AppError.forbidden(`Missing required scope: ${required.join(', ')}`);
    }
    return true;
  }

  private bearerToken(req: AuthenticatedRequest): string {
    const header = req.headers.authorization;
    const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
    if (!match) throw AppError.unauthenticated();
    return match[1];
  }

  private async fromCollectorJwt(token: string): Promise<Principal> {
    let payload: CollectorJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<CollectorJwtPayload>(token);
    } catch {
      throw AppError.unauthenticated();
    }
    if (payload.typ !== 'collector' || typeof payload.sub !== 'string') {
      throw AppError.unauthenticated();
    }
    const collector = await this.collectors.findActiveById(payload.sub);
    if (!collector) throw AppError.unauthenticated();
    return {
      collectorId: collector.id,
      actorType: 'COLLECTOR',
      actorId: collector.id,
      scopes: SCOPES,
    };
  }

  private async fromIntegrationKey(token: string): Promise<Principal> {
    const credential = await this.credentials.authenticate(token);
    if (!credential) throw AppError.unauthenticated();
    const collector = await this.collectors.findActiveById(credential.collectorId);
    if (!collector) throw AppError.unauthenticated();
    return {
      collectorId: credential.collectorId,
      actorType: 'INTEGRATION',
      actorId: credential.id,
      scopes: credential.scopes,
    };
  }
}
