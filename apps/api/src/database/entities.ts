import { AuditEvent } from '../audit/audit-event.entity';
import { Collector } from '../collectors/collector.entity';
import { ContributionIntent } from '../contribution-intents/contribution-intent.entity';
import { ContributionAllocation } from '../contributions/contribution-allocation.entity';
import { Contribution } from '../contributions/contribution.entity';
import { Contributor } from '../contributors/contributor.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { IdempotencyRecord } from '../idempotency/idempotency-record.entity';
import { IntegrationCredential } from '../integration-credentials/integration-credential.entity';
import { SavingsPlan } from '../plans/savings-plan.entity';

export const ENTITIES = [
  Collector,
  Contributor,
  SavingsPlan,
  Enrollment,
  Contribution,
  ContributionAllocation,
  ContributionIntent,
  IntegrationCredential,
  IdempotencyRecord,
  AuditEvent,
];
