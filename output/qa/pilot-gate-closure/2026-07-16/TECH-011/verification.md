# TECH-011 verification — 2026-07-16

Technical result: `pass_ready_pending_matrix_update`

Formal matrix result: `BLOCKED`

The scheduled production backup run `29451202680` produced encrypted artifact `8357639557` with 14-day retention. Restore run `29494683840` restored that exact artifact into a disposable local Supabase stack on a GitHub-hosted runner in 128 seconds. Production was never a restore target.

Organization, profiles/Auth, estimator, orders, production, stock, receivables, payroll, Storage and migration history reconciled. Pseudonymous identity digests matched and are intentionally omitted from the repository evidence. Storage remained zero buckets, objects and bytes. The restored environment contained zero effect-capable cron jobs and was stopped with `--no-backup` by the cleanup trap.

The only non-exact inventory field was `pg_net`: production artifact version `0.19.5`, disposable runtime version `0.20.3`. Extension names matched; the required `net.http_post(text,jsonb,jsonb,jsonb,integer)` signature was present; all business, Auth, Storage and migration inventories matched. Commits `da272ea` and `d07a570` make this narrow compatibility policy and its diagnostic evidence source-controlled on `codex/repository-grounded-architecture-enhancement`.

Formal promotion is withheld until:

1. The compatibility commits are merged to `main` (and a main-ref rerun is retained if the release process requires it).
2. A named independent factory-side verifier reviews this evidence and signs/dates the closure pack.
3. The owner confirms a second approved encrypted/offline copy of the recovery identity before the repository-root candidate is moved or removed.

No production data, production schema, production application deployment or production configuration was changed by the restore drill. The GitHub Actions recovery identity secret was corrected after a failed validation run; its value was never printed or committed.
