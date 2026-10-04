# Local data-rights and formal-operations acceptance

Runtime candidate: **2f0215e4054958513a79a6636285d37ee2b03194**, branch `codex/founder-admin`, worktree `/tmp/weavly-founder-admin`. Main `39b5e15a78af02824453444ef04de1f0d24334b0` was freshly fetched and integrated locally in `af1b9055`. The original checkout remains clean at `36e6e4e`. Later closeout changes are documentation and synthetic evidence only. This is local implementation acceptance, not production acceptance.

## Delivered behavior

- Founder privacy/security intake, explicit adoption of retained source cases, next-action/follow-up queues, acknowledgement and authority evidence, progress, resolution/reopen, private notes and preserved correction history.
- Narrow founder/server RPC boundaries, live grant/MFA/session rechecks, expected versions and stable canonical request-key deduplication. Source updates, private history and required safe audit commit atomically.
- Counts-only retained-record review and six-class retention policy/hold review. Numeric policies are unconfigured; automatic purge is always disabled. Neither screen authorizes erasure or scoped disclosure.
- Account deletion performs no provider cancellation and refuses protected retained linkages before independently locked database recheck. A final regression proves even a revision-only founder/tenant identity link preserves its correction evidence and blocks deletion.
- Complete main-line customer archives and own public support history remain available; operator privacy conversations/private evidence are excluded from factory downloads. Owner unlock intake remains current-owner/organization-scoped and never executes an unlock.
- Memory-only drafts, private/no-store responses, sensitive-route boundaries, safe source failure states and original-payload retries through ambiguous success/throttling. New saves wait for the last confirmed detail version.

The exact approved scope, source contracts, ten-migration inventory and rollback are in [FORMAL_OPERATIONS.md](FORMAL_OPERATIONS.md) and [RELEASE_RUNBOOK.md](RELEASE_RUNBOOK.md). The original specifications remain saved in this checkout. Policy approval is recorded on 4 October 2026 at 12:34:42 UTC; no further policy decision was needed to finish this approved local slice.

## Verification

| Gate | Result | Evidence and limit |
| --- | --- | --- |
| Full unit regression / prebuild | **Passed: 320 files, 2,901 tests; 1 optional live test skipped** | Repeated after the runtime commit. The isolated production build also ran the full prebuild suite. |
| Full lint | **Passed** | `eslint --max-warnings=0` against the committed candidate. |
| Nonincremental typecheck | **Passed** | Prescribed `tsc --noEmit --incremental false`; production build also completed TypeScript. |
| Production webpack build | **Passed** | Node 24.11.1 / Next 16.2.12, loopback service placeholders, no credentials/hosted service setup. Public Google font fetch was approved. |
| Full disposable database suite | **Passed: 28 files, 237 tests** | Exact committed migration set, PostgreSQL 17.11, synthetic Auth metadata, no hosted reset/seed. PostgreSQL 16 not run. |
| Formal component browser fixtures | **Passed: 24 desktop/mobile cases** | Actual client components; synthetic transport/state adapter. Includes request-key retries, stale drafts, adoption, delayed refresh, private notes, required evidence and disabled purge. |
| Factory/report/legacy component fixtures | **Passed: 22 desktop/mobile cases** | Updated navigation/factory context, filters, source coverage, literal markup and honest unavailable states. |
| Founder Auth component fixtures | **Passed: 6 desktop/mobile cases** | Requested wrong-email toast, first private QR/code, returning code-only flow. No actual provider enrollment. |
| Support component fixtures | **Passed: 12 desktop/mobile cases** | Full synthetic lifecycle, own public/private separation, XSS-as-text, drafts and retry keys. |
| Dark built-app boundaries | **Passed: 18; 2 real Auth cases skipped** | Anonymous direct API/deep-link access, forged identity mutations, cache headers/storage. Actual Supabase AAL2/requester round trip remains blocked once per viewport. |
| Public bundle pattern scan | **Passed: 300 JS/source-map assets, 0 findings** | Bounded credential/key patterns; not proof of every possible secret. The isolated build used no real service credentials. |
| Independent exact-commit review | **Passed for reviewed local slice: no open P0/P1 or blocking P2** | Archived exact candidate; 12 targeted unit files / 91 tests, 3 new disposable DB suites / 51 tests, 24 formal browser cases passed independently. Real Auth/staging/production gates remain unverified. |

Browser totals: **82 passed, 2 skipped** across five executable suites. Screenshots are synthetic component scenes or the dark local login, never real customer data. [Formal fixture coverage](FORMAL_COMPONENT_FIXTURES.md) records exact component hashes and test limits. Machine-readable checks are in `evidence/formal-checks.json`; screenshots/results are in `output/playwright/admin-console/{formal-fixtures,read-fixtures,auth-fixtures,support-fixtures}` and the built-app results JSON.

The final DB run also exercised 1,000 synthetic organizations and 5,000 tickets. Ten local samples produced factory aggregate p95 **119 ms** against the proposed 2,000 ms budget and support-list p95 **43.5 ms** against the proposed 1,000 ms budget. These are disposable local fixture measurements, not agreed staging or production guarantees. The new formal slice does not claim a separate staging performance measurement.

Commands:

```text
node scripts/performance/isolated-command.mjs node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/performance/isolated-command.mjs npx vitest run
node scripts/performance/isolated-command.mjs npm run lint
node scripts/performance/isolated-command.mjs npm run test:db
node scripts/performance/isolated-command.mjs npm run build
node scripts/performance/isolated-command.mjs npm run test:admin:browser
npm run test:admin:formal-fixtures
npm run test:admin:read-fixtures
npm run test:admin:auth-fixtures
npm run test:browser:support-fixture
```

Fixture scripts invoke the isolated environment wrapper themselves and use fixed loopback URLs. The disposable DB harness owns creation/teardown. The earlier development fixture/lint failures were corrected and are not recorded as acceptance passes; final commands above exited zero, with the stated intentional skips.

## Remaining gates

1. **Actual identity/security acceptance:** verify the exact approved Auth UUID, protected dedicated profile/grant, real AAL1/AAL2/provider session binding, factor enrollment/recovery, emergency revocation and session policy in an explicitly isolated environment. Production setup still requires its separate approval.
2. **Environment evidence:** PostgreSQL 16 replay, real authenticated browser/network/storage/replay checks, agreed staging budgets, monitored contact delivery, backup/recovery point and staging rollback rehearsal remain unverified. Synthetic fixtures do not satisfy these gates.
3. **Retained-record actions:** approve numeric retention periods/anchors through the reviewed operator process. A concrete scoped disclosure, erasure or pseudonymization plan needs separate review/authorization and a future implementation where required. No executor, purge scheduler or external delivery has been added.
4. **Other operations/reporting:** DPA editing, worker disclosures and lockdown remain outside the approved slice. Production classification and complete capture/refund evidence remain unknown until independently evidenced; billing readiness is unchanged.
5. **Production rollout:** review all ten additive founder migrations and recovery implications, explicitly approve migrations/deployment, then verify the exact deployed commit and customer regressions. No production change is authorized by this acceptance document.

Local implementation used no real customer fixtures and performed no remote push/merge, deployment, production migration/backfill, provider economic action, actual MFA/account/grant change or external customer communication. The approved defaults are implemented; unresolved release gates are stated rather than bypassed.
