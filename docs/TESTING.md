# Test strategy · AjoDesk

## Test layers
1. **Unit:** schedule-date generation, amount computation, summary calculations, normalized request hash, scope predicates.
2. **Integration:** NestJS controllers/services against a real disposable PostgreSQL database with migrations (not SQLite for concurrency/uniqueness behavior).
3. **E2E:** authenticated HTTP flows, including collector JWT and integration API key paths.
4. **Manual demo:** seeded fake collector, Amina, active plan; external HTTP client calls the deployed API; inspect database effect.

## Minimum automated cases
| Area | Test | Expected |
|---|---|---|
| Auth | Invalid login | 401 |
| Isolation | Collector B requests Collector A's enrollment | 404/403, no data |
| Scopes | Read-only key prepares a write | 403 |
| Scope | Integration key maps to collector on server | Ignores supplied collector ID |
| Contributor search | Duplicate names | Multiple matches, no false unique selection |
| Scheduling | Due dates vs future dates | Future dates not overdue |
| Scheduling | Prepaid future date | Recorded total rises, due-to-date outstanding unchanged |
| Recording | One valid ₦1,000 day | Exactly one contribution/allocation/audit event |
| Recording | Two days in one ₦2,000 event | One contribution, two allocations |
| Validation | Wrong amount for chosen days | 400, no financial rows |
| Validation | Invalid/out-of-range scheduled date | 400, no financial rows |
| Duplication | Already paid date with new idempotency key | 409, no duplicate |
| Idempotency | Same key, same payload | Same result |
| Idempotency | Same key, changed payload | 409 |
| Concurrency | Two calls try same date concurrently | One posted event; other safe replay/conflict |
| Intent | Prepare without confirm | No balance change |
| Intent | Expired confirmation | 410, no posting |
| Intent | Repeated confirmation | One contribution ID |
| Intent | Confirmation from wrong credential | 403 |
| Failure | DB rollback after partial insert | No orphan allocations or false success |

## Example end-to-end fixture
- Plan: ₦1,000 per day (`100000` kobo), 2026-10-01 to 2026-10-30.
- Contributor: Amina Yusuf; active enrollment 2026-10-01 to 2026-10-30.
- `asOf`: 2026-10-25 (pass explicitly to make results deterministic).
- Unpaid date: 2026-10-25.
- Before write: read `recordedTotalMinor`.
- Prepare and confirm 2026-10-25 at `100000` minor units.
- After write: total increases by exactly `100000`; date removed from `unpaidDates`.
- Repeat confirm: total remains unchanged.

## Developer instructions
- Run all relevant unit/integration tests after financial logic changes.
- Use a clean DB and migrations in CI; never run destructive integration tests against real data.
- Include test commands in README **after** scripts exist; do not claim test pass without executing them.
- Include a concise request log or curl example for the external integration demonstration, redacting keys and personal data.
