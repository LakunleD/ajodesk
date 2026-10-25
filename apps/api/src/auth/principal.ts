import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export type ActorType = 'COLLECTOR' | 'INTEGRATION';

/** The trusted, server-resolved caller. `collectorId` is the only source of data scope. */
export interface Principal {
  collectorId: string;
  actorType: ActorType;
  /** Collector ID for dashboard sessions; credential ID for integrations. */
  actorId: string;
  scopes: readonly string[];
}

export interface AuthenticatedRequest extends Request {
  principal?: Principal;
}

export const CurrentPrincipal = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const principal = ctx.switchToHttp().getRequest<AuthenticatedRequest>().principal;
  if (!principal) throw new Error('CurrentPrincipal used on an unauthenticated route');
  return principal;
});
