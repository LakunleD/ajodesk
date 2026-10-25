import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1761390000000 implements MigrationInterface {
  name = 'InitialSchema1761390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE collectors (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name varchar(120) NOT NULL,
        email varchar(254) NOT NULL,
        phone varchar(20),
        password_hash varchar NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
        created_at timestamptz(3) NOT NULL DEFAULT now(),
        updated_at timestamptz(3) NOT NULL DEFAULT now(),
        CONSTRAINT collectors_email_lowercase CHECK (email = lower(email))
      );
      CREATE UNIQUE INDEX uq_collectors_email ON collectors (email);

      CREATE TABLE contributors (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        collector_id uuid NOT NULL REFERENCES collectors(id),
        full_name varchar(120) NOT NULL,
        phone varchar(20),
        status varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
        created_at timestamptz(3) NOT NULL DEFAULT now(),
        updated_at timestamptz(3) NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_contributors_collector_name ON contributors (collector_id, full_name);
      CREATE INDEX ix_contributors_collector_created ON contributors (collector_id, created_at DESC, id DESC);

      CREATE TABLE savings_plans (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        collector_id uuid NOT NULL REFERENCES collectors(id),
        name varchar(120) NOT NULL,
        daily_amount_minor bigint NOT NULL CHECK (daily_amount_minor > 0),
        currency varchar(3) NOT NULL CHECK (currency = 'NGN'),
        frequency varchar(16) NOT NULL CHECK (frequency = 'DAILY'),
        start_on date NOT NULL,
        end_on date NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
        created_at timestamptz(3) NOT NULL DEFAULT now(),
        updated_at timestamptz(3) NOT NULL DEFAULT now(),
        CONSTRAINT savings_plans_interval CHECK (end_on >= start_on)
      );
      CREATE INDEX ix_savings_plans_collector_created ON savings_plans (collector_id, created_at DESC, id DESC);

      CREATE TABLE enrollments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        collector_id uuid NOT NULL REFERENCES collectors(id),
        plan_id uuid NOT NULL REFERENCES savings_plans(id),
        contributor_id uuid NOT NULL REFERENCES contributors(id),
        start_on date NOT NULL,
        end_on date NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
        created_at timestamptz(3) NOT NULL DEFAULT now(),
        updated_at timestamptz(3) NOT NULL DEFAULT now(),
        CONSTRAINT enrollments_interval CHECK (end_on >= start_on),
        CONSTRAINT uq_enrollments_plan_contributor UNIQUE (plan_id, contributor_id)
      );
      CREATE INDEX ix_enrollments_collector ON enrollments (collector_id);
      CREATE INDEX ix_enrollments_contributor ON enrollments (contributor_id);

      CREATE TABLE contributions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        collector_id uuid NOT NULL REFERENCES collectors(id),
        enrollment_id uuid NOT NULL REFERENCES enrollments(id),
        amount_minor bigint NOT NULL CHECK (amount_minor > 0),
        currency varchar(3) NOT NULL CHECK (currency = 'NGN'),
        payment_method varchar(16) NOT NULL CHECK (payment_method = 'CASH'),
        verification_status varchar(32) NOT NULL CHECK (verification_status = 'COLLECTOR_ATTESTED'),
        collected_on date NOT NULL,
        idempotency_key varchar(160) NOT NULL,
        request_hash varchar(64) NOT NULL,
        recorded_by_type varchar(16) NOT NULL CHECK (recorded_by_type IN ('COLLECTOR', 'INTEGRATION')),
        recorded_by_id uuid NOT NULL,
        status varchar(16) NOT NULL CHECK (status = 'POSTED'),
        created_at timestamptz(3) NOT NULL DEFAULT now(),
        CONSTRAINT uq_contributions_idempotency UNIQUE (collector_id, recorded_by_id, idempotency_key)
      );
      CREATE INDEX ix_contributions_enrollment_created ON contributions (enrollment_id, created_at DESC, id DESC);

      CREATE TABLE contribution_allocations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        contribution_id uuid NOT NULL REFERENCES contributions(id),
        enrollment_id uuid NOT NULL REFERENCES enrollments(id),
        scheduled_on date NOT NULL,
        amount_minor bigint NOT NULL CHECK (amount_minor > 0),
        CONSTRAINT uq_allocations_enrollment_date UNIQUE (enrollment_id, scheduled_on)
      );
      CREATE INDEX ix_allocations_contribution ON contribution_allocations (contribution_id);

      CREATE TABLE contribution_intents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        collector_id uuid NOT NULL REFERENCES collectors(id),
        enrollment_id uuid NOT NULL REFERENCES enrollments(id),
        created_by_type varchar(16) NOT NULL CHECK (created_by_type IN ('COLLECTOR', 'INTEGRATION')),
        created_by_id uuid NOT NULL,
        dates_json jsonb NOT NULL CHECK (jsonb_typeof(dates_json) = 'array' AND jsonb_array_length(dates_json) > 0),
        amount_minor bigint NOT NULL CHECK (amount_minor > 0),
        currency varchar(3) NOT NULL CHECK (currency = 'NGN'),
        payment_method varchar(16) NOT NULL CHECK (payment_method = 'CASH'),
        status varchar(16) NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED')),
        expires_at timestamptz(3) NOT NULL,
        completed_contribution_id uuid UNIQUE REFERENCES contributions(id),
        completed_at timestamptz(3),
        created_at timestamptz(3) NOT NULL DEFAULT now(),
        updated_at timestamptz(3) NOT NULL DEFAULT now(),
        CONSTRAINT contribution_intents_completion CHECK (
          (status = 'COMPLETED') = (completed_contribution_id IS NOT NULL)
        )
      );
      CREATE INDEX ix_intents_collector ON contribution_intents (collector_id);

      CREATE TABLE integration_credentials (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        collector_id uuid NOT NULL REFERENCES collectors(id),
        label varchar(120) NOT NULL,
        key_prefix varchar(32) NOT NULL UNIQUE,
        secret_hash varchar(64) NOT NULL,
        scopes text[] NOT NULL,
        status varchar(16) NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED')),
        expires_at timestamptz(3),
        last_used_at timestamptz(3),
        created_at timestamptz(3) NOT NULL DEFAULT now(),
        revoked_at timestamptz(3)
      );
      CREATE INDEX ix_credentials_collector ON integration_credentials (collector_id);

      CREATE TABLE idempotency_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        collector_id uuid NOT NULL REFERENCES collectors(id),
        actor_id uuid NOT NULL,
        operation varchar(64) NOT NULL,
        idempotency_key varchar(160) NOT NULL,
        request_hash varchar(64) NOT NULL,
        result_resource_id uuid NOT NULL,
        created_at timestamptz(3) NOT NULL DEFAULT now(),
        CONSTRAINT uq_idempotency_scope UNIQUE (collector_id, actor_id, operation, idempotency_key)
      );

      CREATE TABLE audit_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        collector_id uuid NOT NULL REFERENCES collectors(id),
        actor_type varchar(16) NOT NULL CHECK (actor_type IN ('COLLECTOR', 'INTEGRATION', 'SYSTEM')),
        actor_id uuid,
        action varchar(64) NOT NULL,
        entity_type varchar(64) NOT NULL,
        entity_id uuid NOT NULL,
        metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz(3) NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_audit_collector_created ON audit_events (collector_id, created_at DESC);
      CREATE INDEX ix_audit_entity ON audit_events (entity_type, entity_id);

      -- Posted financial records and the audit trail are append-only.
      CREATE FUNCTION ajodesk_reject_mutation() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION '% on % is not permitted: records are append-only', TG_OP, TG_TABLE_NAME
          USING ERRCODE = 'restrict_violation';
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER contributions_append_only BEFORE UPDATE OR DELETE ON contributions
        FOR EACH ROW EXECUTE FUNCTION ajodesk_reject_mutation();
      CREATE TRIGGER contribution_allocations_append_only BEFORE UPDATE OR DELETE ON contribution_allocations
        FOR EACH ROW EXECUTE FUNCTION ajodesk_reject_mutation();
      CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events
        FOR EACH ROW EXECUTE FUNCTION ajodesk_reject_mutation();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS audit_events, idempotency_records, integration_credentials,
        contribution_intents, contribution_allocations, contributions, enrollments,
        savings_plans, contributors, collectors CASCADE;
      DROP FUNCTION IF EXISTS ajodesk_reject_mutation();
    `);
  }
}
