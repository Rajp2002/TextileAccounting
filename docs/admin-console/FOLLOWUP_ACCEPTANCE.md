# Founder authentication and compatibility follow-up

Historical authentication follow-up evidence follows. The later [data-rights/formal acceptance](DATA_RIGHTS_ACCEPTANCE.md) supersedes its retention/formal owner blockers and provider-cancellation behavior where explicitly stated. Current main `39b5e15a` has been integrated locally; the older runtime/results below remain history, not acceptance for the new slice.

Runtime candidate: **1d951fd9f75b15b24caeeeeb56d16eda3aca7950**, branch `codex/founder-admin`, worktree `/tmp/weavly-founder-admin`. Main remains clean at36e6e4e. Subsequent delivery changes are documentation/evidence only. This is locally verified implementation, not production acceptance.

## User-approved sign-in contract

1. Email plus existing Supabase password. Only `Rajpatel86420@gmail.com` advances; casing/outer whitespace normalize, aliases do not. Other emails receive the requested wrong-email toast. Password/provider failures remain generic.
2. First setup displays a private QR and requires its six-digit authenticator code. Returning users see the code challenge. Email alone cannot enroll or grant access: confirmed current email, protected UUID founder grant, current admin profile and live verified provider session are required. Dashboard data additionally requires AAL2 and a live platform session.

Setup is a same-origin/rate-limited POST operation, never a rendering GET. Serialized intents bind user/session/factor and expire after10minutes; verification generations fence delayed retries. The server generates a PNG from the provider URI, returns no raw secret/URI and stores no QR/OTP. No factor is automatically removed, including an interrupted pending one. Pending-factor exhaustion requires approved recovery. Enrollment and production setup have separate default-off gates. No actual Auth account/grant/factor was modified.

## Compatibility work completed safely

- Customer export now includes only that requester's public support tickets/messages/public timeline, with complete cursor pagination and explicit exclusions. A support-only download also works for authenticated owners whose paid access/Free/lock state blocks business features. Internal notes, peers' tickets, unbound manual tickets, private references, idempotency data and founder audit are excluded.
- Account deletion checks retained support/reporting/MFA links before legacy provider cancellation, then independently rechecks under profile/org locks in the database transaction. Populated retained records refuse deletion; no cascade, purge or retention period is invented. A blocker arriving after preflight can still refuse deletion after legacy subscription cancellation. A cross-provider deletion-intent fence is not implemented.
- Formal read-only lists/details now cover grievances, security incidents, DPA templates/bindings and notices with fixed fields, keyset pagination, safe text and actual read-success/failure audit. Old unbounded reference actions remain behind a separate disabled gate. No retained mutation/export/lockdown/signing/notification UI was enabled.

## Final local checks

| Gate | Result | Evidence and limit |
| --- | --- | --- |
| Unit/prebuild regressions | **Passed:306 files,2777 tests;1 skipped** | Production build repeated the full suite. Existing optional live Supabase finance test intentionally skipped. |
| Full lint / nonincremental typecheck | **Passed / passed** | `eslint --max-warnings=0`; prescribed `tsc --noEmit --incremental false`. |
| Production webpack build | **Passed** | Next16.2.12, Node24.11.1, isolated loopback service placeholders; existing public-font fetch approved. |
| Complete DB migration/regression suite | **Passed:24 files,180 tests,exit0** | Disposable PostgreSQL17.11 plus synthetic Auth metadata; no hosted reset/seed. Latest run had clean teardown; earlier shutdown warning was not reproduced, not claimed fixed. PostgreSQL16 not run. |
| Built-app desktop/mobile boundaries | **Passed:16;2 skipped** | Real anonymous/disabled routes and new candidate/formal/export APIs. Real Supabase AAL2/requester lifecycle test skipped once per viewport. |
| Auth component browser fixtures | **Passed:6** | Real forms; synthetic wrong-email toast, first QR and returning code-only screenshots. No real provider enrollment. |
| Support component browser fixtures | **Passed:12** | Synthetic full lifecycle, private/public separation, XSS-as-text, drafts and stable retry. |
| Factory/report/formal component browser fixtures | **Passed:22** | Synthetic filters/paging/detail, payment coverage, Today/System/Audit, formal escaping/read-only/mobile states. |
| Public JS/source-map pattern scan | **Passed:288 assets,0 findings** | Bounded pattern scan; not proof of every possible secret. |
| Independent follow-up review | **Incomplete final confirmation** | Reviewer passed7 unit files/90 tests and2 DB files/21 tests incrementally. Restart, cleanup fencing and lease-generation findings were corrected. Final delayed-verification factor-removal concern was addressed by removing all `unenroll` calls; reviewer hit usage limit before confirming final commit. Release remains dark. |

Final local scale:1000 synthetic organizations/5000 tickets,10 samples; factory aggregate p95 **88ms** (proposed2000ms budget), support list p95 **36.95ms** (proposed1000ms budget). These are local fixtures, not approved staging or production guarantees.

Commands/logs are recorded in evidence/checks.json. Screenshots and browser result JSON are in output/playwright/admin-console. All screenshots use synthetic data or the dark built-app login. No real customer fixture was used.

## Exact remaining gates

| Gate | Needed next | Nature |
| --- | --- | --- |
| Founder identity/security | Confirm exact existing Auth UUID and dedicated profile/grant; approve MFA enrollment/recovery, session timings and secure emergency revoke; verify real AAL1/AAL2/session behavior. | Identity evidence plus explicit security setup approval; email is not enough. |
| Retention/data rights | Decide retained/private/financial/security record access, retention and deletion/pseudonymization; implement and test those semantics. Review the preflight→legacy cancellation race/deletion fence. | **Policy decision plus remaining local code**, not approval-only. |
| Formal/security operations | Verify current operational owner/live need; specify and implement retained mutation/export/signing/lockdown/delivery commands with validated inputs, atomic outcome audit and failure tests. | **Operational decision plus remaining local replacement code**, not a finished fallback awaiting a flag. Read-only investigation is delivered. |
| QA environment | PostgreSQL16 replay, real isolated Supabase Auth fixtures, actual authenticated browser/network/storage/replay tests, agreed staging profiling and recovery/rollback rehearsal. | Missing environment/evidence; local mocks cannot satisfy it. |
| Independent review | Fresh reviewer confirms final1d951fd9 changes and remaining corrections. | Usage-limit blocker; final independent approval not claimed. |
| Reporting provenance | Approve evidenced production classification/mapping and bounded provider/history reconciliation; verify complete capture/refund coverage. | Evidence/data-operation approval. Unknowns remain excluded/partial. |
| Rollout | Review seven additive migrations and recovery point, approve production changes/deployment, then verify exact deployed version/customer regressions/live signals. | Explicit production approval plus actual execution/evidence; not performed. |

AD00–AD11 status/rollback is in DELIVERY_LEDGER.md. AD09 remains partial; AD10 has local verification with missing gates; AD11 is preparation only. Release gates apply to endpoints/actions, not just navigation. No push/merge/deploy, production migration/backfill, live-payment enablement, real customer message or actual MFA/grant change occurred.

## Prior evidence-only revision verified

`git diff --name-only 2e3d4974 5edd1c61` contains only four admin documentation/evidence files and selected browser PNG/result JSON files. No executable source changed between those revisions. This follow-up does change executable code and therefore reran the affected complete checks; the old runtime results are not used as acceptance for new authentication or compatibility behavior.
