import { SetMetadata } from '@nestjs/common';
import type { Scope } from '../integration-credentials/scopes';

export const IS_PUBLIC = 'ajodesk:isPublic';
export const REQUIRED_SCOPES = 'ajodesk:requiredScopes';
export const COLLECTOR_ONLY = 'ajodesk:collectorOnly';

/** Route needs no credential. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Integration credentials must hold every listed scope. Collector sessions hold all scopes. */
export const RequireScopes = (...scopes: Scope[]) => SetMetadata(REQUIRED_SCOPES, scopes);

/** Only a collector dashboard session may call the route; integration keys get 403. */
export const CollectorOnly = () => SetMetadata(COLLECTOR_ONLY, true);
