# TECH-011 — Production Backup and Restore Closure Pack

Prepared: 2026-07-14 IST

Current status: `BLOCKED` (`pilot_core`, gating)

Backup owner: **Raj Patel**

Restore operator: **Raj Patel**

Independent verifier: **Named factory-side reviewer (name pending; database credentials are not required)**

## Canonical requirement

> Verify backup schedule and perform restore into a disposable project.

Expected: restored organization, users, production, stock, receivables, and payroll reconcile.

## Existing evidence and exact remaining gap

- `output/qa/blocked-row-campaign/B18-qa-backup-restore.json` proves a sanitized logical fixture restored into isolated QA in 2,478.4 ms. Organization, two users, production, stock, receivables, and payroll reconciled to identical SHA-256 digests; restored-owner sign-in and cleanup passed.
- `output/qa/blocked-row-campaign/B18-recovery-runtime.json` records that production was not mutated and the disposable resources were cleaned up.
- A fresh read-only check on 2026-07-14 ran `npx supabase backups list --project-ref vzhwahudircrpgtitwzd --output json` and returned WAL-G enabled, PITR disabled, and no listed backups. The connected organization reports the `free` plan.
- Supabase documents that Pro/Team/Enterprise projects receive retained daily backups and that Free projects should regularly export with `supabase db dump` and maintain off-site backups: <https://supabase.com/docs/guides/platform/backups>.
- Current official CLI guidance uses roles, schema and data dumps, with migration history exported separately; database backups contain Storage metadata but not object bytes: <https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore>.
- The implemented [free-tier runbook](TECH-011_BACKUP_RESTORE_RUNBOOK.md) and two GitHub Actions workflows prepare a daily encrypted logical backup and an ephemeral restore drill. All required Actions setting names are configured, but first scheduled run `29368765626` failed closed during sanitized-inventory parsing and produced no artifact. Neither workflow has produced closure evidence.

The B18 fixture proves restore mechanics only. It is not a retained production backup, and it must not be cited as closure proof for this row.

## Current production backup architecture

| Control | Observed state | Meaning |
| --- | --- | --- |
| Hosted database | Supabase project `vzhwahudircrpgtitwzd`, `ap-south-1`, healthy | Production source in scope |
| WAL archival engine | WAL-G enabled | Platform capability exists; it does not prove accessible retention |
| PITR | Disabled | No point-in-time restore window |
| Retained backups exposed | None | No scheduled retained artifact can currently be selected and restored |
| Organization plan | Free | Paid managed backups/PITR/branching are not required for this pilot; Supabase recommends regular CLI exports and off-site retention for Free projects |
| Database | Postgres `17.6.1.063`; healthy; remote migration history present | The restore target must support the current Supabase/Postgres baseline and verify the exact migration head |
| Installed effect-capable extensions | `pg_cron` and `pg_net` are installed | Disposable restore must not carry production secrets or external side effects |
| Supabase Storage | Read-only database query: `0` buckets, `0` objects, `0` bytes; no active Storage client found in source | Database-only coverage is currently sufficient for pilot records, but the workflow must fail if objects appear |
| Existing CI/CD | Private GitHub repository; no Actions workflows, Actions secrets or Actions variables existed at inspection time | New workflows can use private artifacts, but owner configuration and a default-branch merge are still required |
| Implemented off-site schedule | Daily `20:17 UTC` encrypted logical backup, private Actions artifact, 14-day retention | Workflow is active on the default branch and required setting names are configured. First scheduled run `29368765626` failed closed during sanitized-inventory parsing and produced no artifact. |
| Local credentials | Management/API login and server API keys exist; no database password/connection URL is available | Read-only inventory works, but a real CLI dump cannot be run or delegated without the database URL secret |

No production backup setting, plan, secret, data or schema was changed while preparing this pack. No dump was committed or retained locally.

## Safest supported architecture

### Pilot control: encrypted off-Supabase logical dump

The safest currently supportable Free-plan route is implemented in `.github/workflows/supabase-production-backup.yml` and `scripts/backup/create-supabase-logical-backup.sh`:

```text
supabase db dump --db-url "$PRODUCTION_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$PRODUCTION_DB_URL" -f schema.sql
supabase db dump --db-url "$PRODUCTION_DB_URL" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
supabase db dump --db-url "$PRODUCTION_DB_URL" -f history-schema.sql --schema supabase_migrations
supabase db dump --db-url "$PRODUCTION_DB_URL" -f history-data.sql --schema supabase_migrations --use-copy --data-only
```

The runner creates a sanitized count/tenant-boundary/digest inventory, refuses to continue if any Storage object exists without object-byte coverage, hashes each layer, records project/commit/time/tool identity, archives it, encrypts with standard `age`, uploads only ciphertext plus a receipt to a private GitHub Actions artifact, and removes plaintext. Retention is 14 days. Failures open/update a repository issue.

`.github/workflows/supabase-production-restore-drill.yml` downloads one exact scheduled artifact and restores it into an ephemeral local Supabase stack. It verifies startup, roles/schema/data order, migration history, extensions, Auth linkage, organization/users, estimator, orders, production, stock, receivables, payroll, tenant boundaries and identity digests, then stops with `--no-backup`.

This is an explicitly interim pilot control: repository readers with Actions access can download artifacts; GitHub administrators can delete them; artifact and decrypt secret share the GitHub control plane; retention is not immutable and has no monthly archive. `PP-TECH-011-001` records the post-pilot move to an independent immutable object store/security boundary.

Paid Supabase managed backups/PITR/branching remain optional defense in depth, not a prerequisite for this pilot.

## Owner-approved limited-pilot policy

Documented owner decision: **Raj Patel — 2026-07-14 IST**

| Field | Approved decision |
| --- | --- |
| Backup method | Daily encrypted Supabase/PostgreSQL logical backup stored as a private GitHub Actions artifact |
| Schedule/time zone | Daily `20:17 UTC` / `01:47 IST` next day |
| Retention | 14 days during the limited pilot |
| Recovery Point Objective (RPO) | Maximum 24 hours of data loss |
| Target Recovery Time Objective (RTO) | 4 hours, subject to confirmation by the first measured restore exercise |
| Backup owner | Raj Patel |
| Restore operator | Raj Patel |
| Independent verification | A named factory-side reviewer who does not require access to database credentials; the individual name must be recorded before closure |

Known limitations accepted for the limited pilot:

- No point-in-time recovery.
- GitHub artifact storage is off-Supabase but is not a fully independent disaster-recovery platform.
- Supabase Storage file bytes are not included.
- The workflow must fail closed if Supabase Storage begins containing objects.
- This is an interim pilot control and must be hardened post-pilot.

Post-pilot hardening requires moving encrypted backups to separate object storage, increasing retention, adding periodic restore drills, and evaluating Supabase managed backups and PITR.

## Required closure artifacts

- [x] Dated owner approval of the interim route, 14-day retention, limitations, RPO/RTO, backup owner, and restore operator (recorded in the owner-approved policy above).
- [x] GitHub Actions settings evidence showing the four required names exist, with values uninspected and undisclosed.
- [ ] Default-branch workflow/schedule evidence and responsible operator’s failure-notification confirmation.
- [ ] One completed scheduled production backup artifact created after enablement; manual “run now” alone is insufficient unless the schedule subsequently runs successfully.
- [ ] Artifact identifier, source project ref, capture time, size/checksum where available, and retention expiry.
- [ ] Disposable GitHub runner/local Supabase target identifier and start/stop timestamps.
- [ ] Redacted before/after counts and canonical digests for organization, users/Auth, estimator, orders, production, stock, receivables, payroll, migration history and extensions.
- [ ] Storage coverage statement showing the backup-time object count and, if non-zero, separate object-byte backup/restore proof.
- [ ] Restore start/end timestamps and measured RTO.
- [ ] Verification that production project/data was not altered.
- [ ] Cleanup proof showing the disposable target was deleted or fully isolated according to the approved cleanup plan.
- [ ] Named operator and independent verifier, dated approval, and variance explanations.

## Non-destructive restore exercise

1. Select an identifiable scheduled Actions artifact, not a synthetic fixture or manual-only run.
2. Trigger the restore-drill workflow with that run ID and exact artifact name.
3. Keep the production application pointed at production. Do not change Vercel production environment variables or aliases; the script accepts only its newly created local database URL.
4. Confirm no production secrets/Edge Functions are copied to the disposable stack.
5. Compare only scoped, redacted measurements from the encrypted inventory:

| Domain | Source count/digest | Restored count/digest | Match | Notes |
| --- | --- | --- | --- | --- |
| Organization |  |  | [ ] |  |
| Users/auth identities |  |  | [ ] |  |
| Estimator quotes |  |  | [ ] |  |
| Orders |  |  | [ ] |  |
| Production |  |  | [ ] |  |
| Stock |  |  | [ ] |  |
| Receivables |  |  | [ ] |  |
| Payroll |  |  | [ ] |  |

6. Verify schema/migration head, required extensions, Auth record linkage, Storage object count, null/orphan tenant counts and exact pseudonymous identity digests.
7. Explain every mismatch. A mismatch is a failure until corrected and rerun.
8. Delete or formally quarantine the disposable target, then have the independent verifier sign.

## Acceptance criteria

`TECH-011` may become `PASS` only when all statements are true:

- An automated retained production schedule exists and has produced at least one identifiable artifact.
- That exact scheduled artifact, not the B18 fixture, was restored into disposable infrastructure.
- Organization, users/Auth, estimator, orders, production, stock, receivables and payroll reconcile with no unexplained variance; migration head/extensions and tenant boundaries also match.
- Storage object bytes are either absent (verified count zero at backup time) or separately exported, retained, restored and hash-verified.
- The measured restore time meets the owner-approved RTO and artifact age meets the RPO/retention policy.
- Production was not restored over, modified, redirected, or exposed to clone side effects.
- Evidence is redacted, the disposable target is cleaned up, and a named independent verifier dated the approval.

## Exact matrix-update procedure after real closure

1. Create `output/qa/pilot-gate-closure/YYYY-MM-DD/TECH-011/` and store the signed approval, redacted schedule proof, artifact manifest, restore/reconciliation result, and cleanup proof.
2. In `output/qa/PILOTQA-20260621-2058-8QIH/results.json`, edit only the `TECH-011` item:
   - set `status` from `blocked` to `pass`;
   - replace `actual` with the scheduled artifact ID/time, disposable target, six-domain reconciliation, restore duration, production-safety statement, and cleanup result;
   - replace/add `evidence` paths pointing to the new artifacts while retaining B18 as supporting history only;
   - replace `notes` with the fulfilled schedule/restore statement;
   - set `updatedAt` to the real ISO-8601 approval time;
   - preserve `release_scope: "pilot_core"`, `pilot_gating: true`, severity, scenario, and expected result.
3. Update only the `TECH-011` row in `TEST_MATRIX.md` to match the ledger exactly.
4. Recalculate counts from the ledger; do not assume a count because other gates may have changed:

```text
jq -r '.items | group_by(.status) | map({status: .[0].status, count: length})' output/qa/PILOTQA-20260621-2058-8QIH/results.json
```

5. Update `REMAINING_GATE_REPORT.md`, `FAILURE_BACKLOG.md`, `LOOP_STATE.md`, `FIX_LOG.md`, and `PILOT_READY_DEFINITION.md` only to cite the new artifact and new calculated counts. Do not promote `UX-012`, `GOLDEN-A-03`, or `SIGNOFF-04` indirectly.
6. Run `git diff --check`, verify the evidence paths exist, and have a second person confirm the matrix row before commit.

## Exact human and laptop actions still required

1. **Human:** owner approval of the interim private-GitHub artifact route, 14-day retention/limitations, RPO/RTO, backup owner and restore operator is recorded above. Record the individual factory-side verifier's name before closure; the verifier does not need database credentials. No paid-plan upgrade is required.
2. **Owner laptop:** generate one standard `age` identity outside the repository, keep an encrypted/offline recovery copy, and configure the four exact GitHub Actions names from the runbook. Paste the database URL only into the secret form; never send it back in chat.
3. **Repository owner:** merge the workflow to the default branch and enable Actions failure notifications/Issues.
4. **Wait for automation:** observe one successful scheduled run (not only manual), then record run ID, artifact name/ID, timestamps, encrypted size/SHA-256 and 14-day expiry.
5. **Restore operator laptop:** trigger the restore workflow with that scheduled run ID/artifact name; retain the private `restore-result.json`, measured recovery time and cleanup log.
6. **Independent verifier:** confirm exact reconciliation, Storage coverage, production was never targeted, cleanup completed, and sign/date the pack.
7. **Documentation operator:** apply the exact matrix procedure above. Until step 6 succeeds, keep `TECH-011` `BLOCKED`.
