# Security and integration access · AjoDesk

## Threat model
The system stores personal information and collector-attested financial records. Main risks: a collector seeing another collector's records, a leaked integration key, a malicious/incorrect automated tool call, duplicated writes due to retries, and a fake claim that cash was received.

## Collector access
- Hash passwords with a modern algorithm such as Argon2id.
- Rate-limit login/register; validate input; disable weak/default credentials outside the demo.
- Use short-lived JWT access or server-managed sessions for the dashboard. If cookies are used, set `HttpOnly`, `Secure` and appropriate `SameSite` protections and consider CSRF.
- Every data access verifies the authenticated collector owns the resource. Prefer returning 404 for another collector's resource IDs.
- Use HTTPS for remote access; restrict CORS to known web origins (CORS is **not** authentication).

## Third-party credentials
- Issue strong random integration keys; show secret once; store only a secure hash and a nonsecret identifying prefix.
- Tie each credential to **one collector**, not to a client-provided `collectorId`.
- Attach explicit scopes: `contributors:read`, `contributors:write`, `plans:read`, `plans:write`, `enrollments:read`, `enrollments:write`, `contributions:read`, `contributions:prepare`, `contributions:confirm`. The operator CLI issues read + prepare + confirm by default; the `*:write` scopes must be requested explicitly. Integration keys can never call `POST /contributions`.
- Key format: `ajd_<12-hex prefix>_<43-char secret>`. The DB stores the prefix (for lookup) and an HMAC-SHA256 of the full key using `INTEGRATION_KEY_PEPPER`. Rotating the pepper invalidates every issued key.
- Revoke credentials without deleting audit history; optionally expire and rotate.
- Use `Authorization: Bearer <key>` over TLS. Do not accept keys in URLs.
- Keep keys in external client server-side secrets. Never expose them to browsers, downloadable files, or logs.
- For the exercise, provision a demo-scoped credential through an operator-only seed/CLI procedure; do not build a public credential-creation endpoint until authorization and lifecycle management are tested.

## Safe recording flow
- Only an authorized collector (direct dashboard) or an authorized scoped integration (prepare/confirm) can record cash.
- A `PENDING` contribution intent has no financial effect. It binds amount, dates, enrollment and caller. It expires and may be completed once.
- Confirmation must be from the same authenticated credential/principal or explicitly supported trusted binding.
- Duplicate confirmation returns the original result; an unknown result should be resolved using GET intent status or original idempotency key.
- The backend must check dates, ownership, amount, and duplicates **again at commit** because state could change after preparation.
- Do not claim the backend verifies that physical cash changed hands. For real operations, additional identity verification, training, audit review, customer dispute channels and an incident response plan are necessary.

## Privacy and operations
- Collect the minimum contributor data necessary, and give collectors access/export/correction processes as appropriate.
- Separate demo from production data. Use fictional demo data only.
- Do not store unnecessary identity documents or complete WhatsApp transcripts.
- Protect database connectivity; backups and restore tests are production requirements.
- Add structured request IDs and audit actions. Redact names/phones in generic error logs where possible and always redact credentials.
- Follow applicable Nigerian data-protection and financial-services requirements before using the product with real customers. No licensing conclusion is asserted by this document.

## Security checklist
- [x] No cross-collector read access (e2e).
- [x] No cross-collector write access (e2e).
- [x] Integration tokens hashed and scoped (e2e).
- [x] Revoked token denied (e2e). Expiry is enforced in code but has no dedicated test yet.
- [x] Intent can be confirmed once (e2e, including concurrent confirms).
- [x] Concurrency does not duplicate paid dates (e2e).
- [x] Request logs record method, path, status and request ID only. TypeORM failed-query logging, which includes parameters, is disabled. The web app calls the API server-side only, and its session cookie is HttpOnly. A headless-browser check confirmed `document.cookie` cannot read the session.
- [ ] API returns accurate failure status after dependency errors: mapped to `503 SERVICE_UNAVAILABLE` in code, but not yet exercised by a test.
