# TECH-011 — Free-Tier Backup and Restore Runbook

Prepared: 2026-07-14 IST

Current gate state: `BLOCKED`. This runbook is an implemented control design, not proof that a backup has run or restored.

## Control summary

| Control | Pilot implementation |
| --- | --- |
| Source | Supabase production project `vzhwahudircrpgtitwzd` (Postgres 17, Free plan) |
| Schedule | GitHub Actions daily at `20:17 UTC` (`01:47 IST` the following calendar day) |
| Workflow | `.github/workflows/supabase-production-backup.yml` |
| Backup tool/order | Supabase CLI `2.109.1`: roles → application schema → data → migration-history schema → migration-history data |
| Database coverage | Roles, public/application schema, data including Auth records and Storage metadata, migration history, sanitized reconciliation inventory |
| Storage object bytes | Not included. The workflow fails closed if `storage.objects` is non-zero. Production had zero buckets/objects/bytes in the 2026-07-14 read-only check. |
| Encryption | `age` public-key encryption before upload; plaintext exists only in an ephemeral runner directory removed by an EXIT trap |
| Off-site/interim destination | Private GitHub Actions artifact in `Rajp2002/TextileAccounting`, outside the Supabase account |
| Retention | 14 days per artifact |
| Integrity | SHA-256 per payload file plus SHA-256 of the encrypted archive |
| Identification | UTC backup ID, source project ref, source commit, Supabase CLI version, capture timestamps and restore order |
| Failure visibility | Failed workflow plus an automatically opened/updated repository issue linking the failed run |
| Restore target | Ephemeral local Supabase stack on a GitHub-hosted runner; never production |
| Restore workflow | `.github/workflows/supabase-production-restore-drill.yml` |
| Restore checks | Cipher/payload integrity, database start, documented order, exact migration head/extensions, sanitized domain counts, tenant-boundary invariants and pseudonymous identity digests |
| Cleanup | `supabase stop --no-backup` and ephemeral runner/work-directory deletion |

## Required GitHub configuration

Values must be entered through GitHub Actions settings or the authenticated `gh` prompts. Do not paste them into a tracked file, terminal command argument, issue, screenshot or chat.

| Name | Type | Purpose | Minimum owner action |
| --- | --- | --- | --- |
| `SUPABASE_PRODUCTION_DB_URL` | Actions secret | Percent-encoded Postgres session-pooler/direct URL with database password and SSL | Copy the connection string from Supabase **Connect** using the database password; enter it as a repository Actions secret. Do not use an anon/service-role API key. |
| `SUPABASE_PRODUCTION_PROJECT_REF` | Actions variable | Public source-project identity in manifest | Set to `vzhwahudircrpgtitwzd`. |
| `BACKUP_AGE_RECIPIENT` | Actions variable | Public `age1...` encryption recipient | Generate one owner-controlled age identity and store its public recipient here. |
| `BACKUP_AGE_IDENTITY` | Actions secret | Private age identity used only by the restore drill | Store the full private identity as a secret and retain a second encrypted/offline owner recovery copy. |

The repository inspection on 2026-07-14 found none of these secret/variable names configured. Linked Supabase metadata and API keys do not provide the database password, and the linked dump could not complete non-interactively. No credential was printed or copied.

## One-time owner setup

1. Install the standard `age` tool on the owner laptop if it is not present. On Homebrew-managed macOS: `brew install age`.
2. In a private folder outside this repository, run `umask 077`, then `age-keygen -o weavly-production-backup.agekey`.
3. Obtain the public recipient without revealing the private identity: `age-keygen -y weavly-production-backup.agekey`.
4. In GitHub → repository → **Settings → Secrets and variables → Actions**:
   - create variable `SUPABASE_PRODUCTION_PROJECT_REF` with the public project ref;
   - create variable `BACKUP_AGE_RECIPIENT` with the public `age1...` recipient;
   - create secret `BACKUP_AGE_IDENTITY` with the complete private identity file;
   - create secret `SUPABASE_PRODUCTION_DB_URL` by pasting the percent-encoded Supabase Postgres connection URL directly into the secret form.
5. Store an encrypted/offline recovery copy of `weavly-production-backup.agekey`; delete any unprotected duplicate after verifying the copy.
6. Merge the workflow to the default branch. GitHub runs `schedule` events only from the default branch’s workflow definition.
7. In GitHub notification settings, enable failed Actions notifications for the responsible operator. Confirm repository Issues are enabled for the automated failure record.

## Daily backup operation

1. The scheduled workflow validates only the presence of required settings; it never prints their values.
2. It creates the five official logical dump layers and a sanitized inventory.
3. It checks `storage.objects`. Any non-zero value stops the run before upload and tells the owner that object-byte export must be designed.
4. It records file hashes and a manifest, archives the payload, encrypts with `age`, and uploads only ciphertext plus a non-sensitive receipt.
5. GitHub retains the private artifact for 14 days. A successful job summary records the backup ID, SHA-256 and retention.
6. On failure, treat the day as **not backed up**. Open the linked run from the issue, repair configuration/tool/network/storage coverage, rerun safely, and record the resolution. Never close the issue merely because a retry started.

## Selecting a closure artifact

For `TECH-011`, use a successful **scheduled** run, not only `workflow_dispatch`. Record:

- workflow run URL/ID and attempt;
- exact artifact name and backup ID;
- capture start/end UTC;
- source commit and project ref;
- encrypted byte size and SHA-256;
- creation and expiry dates;
- screenshot or exported run summary with secrets/data absent.

## Non-destructive restore drill

1. GitHub Actions → **Supabase production backup restore drill** → **Run workflow**.
2. Enter the scheduled backup run ID and exact artifact name.
3. The workflow downloads only that private artifact and decrypts it in the ephemeral runner using `BACKUP_AGE_IDENTITY`.
4. It verifies every payload SHA-256 before starting restore.
5. It creates a new local Supabase stack in a temporary directory. Production’s URL is never accepted as a restore target.
6. It restores roles, schema and data in one transaction with trigger enforcement disabled only for the restore session, then restores migration history.
7. It verifies database startup, migration head, installed extensions, Auth record counts/linkage, organization/users, estimator, orders, production, stock, receivables and payroll. For tenant-bearing domains it compares row count, distinct organization count, null/orphan organization counts and SHA-256 identity digest.
8. It records restore start/end UTC and elapsed recovery seconds in `restore-result.json` and uploads that as private evidence for 30 days.
9. The EXIT trap stops the local stack with `--no-backup` and deletes the workspace. The GitHub-hosted runner is then destroyed.
10. An independent verifier inspects the selected backup receipt, restore-result artifact and cleanup log before signing the closure pack.

Do not promote the gate if the restore job fails, the selected artifact is from a manual-only backup, the artifact has already expired, any reconciliation differs, Storage had uncovered objects, or cleanup is uncertain.

## Auth and configuration limitations

The logical data dump includes Auth database records such as users/identities/sessions according to Supabase’s CLI dump behavior, and the inventory reconciles the important record counts/linkage. It does not back up database passwords, Supabase project JWT secrets, OAuth/provider credentials, Edge Function secrets, third-party webhook settings, DNS, or Vercel configuration. Those secrets must remain in their provider stores and are not copied into a disposable restore. Operational recovery therefore requires the source-controlled application/migrations plus separately controlled provider configuration.

## Storage-object rule

The 2026-07-14 read-only database check found `0` Storage buckets, `0` objects and `0` object bytes. Source inspection found no active application Storage client; one historical migration defines a private `compliance_proofs` bucket/policy, but no bucket currently exists in production.

If any Storage object appears later:

1. the database workflow deliberately fails;
2. `TECH-011` cannot pass using a database-only artifact;
3. classify each bucket’s pilot criticality and retention/privacy needs;
4. implement an authenticated object-byte export to an independently retained encrypted destination while preserving bucket/key/version/hash metadata;
5. restore representative objects and verify bytes/hashes before resuming closure.

Storage metadata rows in PostgreSQL are never evidence that file bytes are recoverable.

## Interim-control limitations and post-pilot hardening

- Repository readers with Actions access can download private artifacts; GitHub administrators can delete artifacts or change retention.
- The artifact and automated decrypt secret share the GitHub control plane, so this is off-Supabase but not independent of a GitHub account compromise.
- Fourteen-day retention gives no monthly/yearly archive and no immutable/WORM guarantee.
- GitHub Actions availability and scheduling are external dependencies; the owner must notice missed/failed runs.
- The workflow covers the database and fails closed for Storage; it is not a full Supabase-project configuration backup.

Post-pilot item `PP-TECH-011-001` requires an owner-controlled object store in a separate security boundary with lifecycle/immutability, KMS or separately controlled age key, longer retention, stale-backup alerting, Storage object export if used, and recurring restore drills.
