import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Collector } from '../collectors/collector.entity';
import { normalizeEmail } from '../collectors/collectors.service';
import { IntegrationCredentialsService } from '../integration-credentials/integration-credentials.service';
import { SCOPES } from '../integration-credentials/scopes';
import { withAppContext } from './cli-context';

/**
 * Operator-only credential management. There is deliberately no HTTP endpoint for this.
 *
 *   credential:create -- --email <collector> --label <text> [--scopes a,b] [--expires-days N]
 *   credential:list   -- [--email <collector>]
 *   credential:revoke -- --id <credential-uuid>
 */
const DEFAULT_SCOPES = [
  'contributors:read',
  'plans:read',
  'enrollments:read',
  'contributions:read',
  'contributions:prepare',
  'contributions:confirm',
];

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const match = /^--([a-z-]+)$/.exec(argv[i]);
    if (match && argv[i + 1] !== undefined) {
      args[match[1]] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  await withAppContext(async (app) => {
    const credentials = app.get(IntegrationCredentialsService);
    const dataSource = app.get(DataSource);
    const findCollector = async (email: string) => {
      const collector = await dataSource.manager.findOne(Collector, {
        where: { email: normalizeEmail(email) },
      });
      if (!collector) throw new Error(`No collector with email ${email}`);
      return collector;
    };

    switch (command) {
      case 'create': {
        if (!args.email || !args.label) throw new Error('--email and --label are required');
        const collector = await findCollector(args.email);
        const scopes = args.scopes ? args.scopes.split(',').map((s) => s.trim()) : DEFAULT_SCOPES;
        const days = args['expires-days'] ? Number(args['expires-days']) : null;
        if (days !== null && (!Number.isInteger(days) || days <= 0)) {
          throw new Error('--expires-days must be a positive integer');
        }
        const { credential, secret } = await credentials.issue({
          collectorId: collector.id,
          label: args.label,
          scopes,
          expiresAt: days ? new Date(Date.now() + days * 86_400_000) : null,
        });
        console.log(`Credential ${credential.id} (${credential.keyPrefix}) for ${collector.email}`);
        console.log(`Scopes: ${credential.scopes.join(', ')}`);
        console.log(`Expires: ${credential.expiresAt?.toISOString() ?? 'never'}`);
        console.log("\nAPI key (shown once; store it in the client's server-side secrets):\n");
        console.log(secret);
        return;
      }
      case 'list': {
        const collectorId = args.email ? (await findCollector(args.email)).id : undefined;
        const rows = await credentials.list(collectorId);
        console.table(
          rows.map((c) => ({
            id: c.id,
            prefix: c.keyPrefix,
            label: c.label,
            status: c.status,
            scopes: c.scopes.join(','),
            lastUsedAt: c.lastUsedAt?.toISOString() ?? '',
          })),
        );
        return;
      }
      case 'revoke': {
        if (!args.id) throw new Error('--id is required');
        const ok = await credentials.revoke(args.id);
        console.log(ok ? `Revoked ${args.id}` : `No credential ${args.id}`);
        if (!ok) process.exitCode = 1;
        return;
      }
      default:
        throw new Error(
          `Unknown command "${command}". Use create | list | revoke. Scopes: ${SCOPES.join(', ')}`,
        );
    }
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
