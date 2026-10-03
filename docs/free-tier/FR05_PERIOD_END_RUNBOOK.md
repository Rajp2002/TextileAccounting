# FR05: Free monthly period_end runbook

Migration: `supabase/migrations/20261004090000_free_monthly_period_end_local_month.sql`. It redefines `commit_free_calculation` so a new monthly row stores the India-time month end, adds `free_local_month_end(timestamptz, text)`, and backfills `period_end` on existing month-policy rows. It changes no `used`, `allowance`, `period_start`, `policy_version`, receipt, saved snapshot, grant, entitlement or retention schedule.

**Applied to production on 2026-10-04** at the owner's request. See [Production application record](#production-application-record) at the end. Any other target still needs its own approval.

## What was wrong

The function runs with `timezone = 'UTC'` and stored `v_start + interval '1 month'`, where `v_start` is the IST month start (the previous day at 18:30 UTC). UTC month arithmetic clamps to the shorter preceding month, so these months ended early:

| Month | Stored end (UTC) | Correct end (UTC) |
| --- | --- | --- |
| March | 28 Mar 18:30 (29 in leap years) | 31 Mar 18:30 |
| May | 30 May 18:30 | 31 May 18:30 |
| July | 30 Jul 18:30 | 31 Jul 18:30 |
| October | 30 Oct 18:30 | 31 Oct 18:30 |
| December | 30 Dec 18:30 | 31 Dec 18:30 |

Bucket selection used the correct start, and `/api/free/status` derives its reset date independently (`freeQuotaWindow`), so no early refill or wrong displayed reset was found. The wrong value was returned as the calculate receipt's `resetsAt`, and the inactive `weavly-free-retention` job would treat such rows as prunable a day early. Since FR02, the browser never shows the receipt's `resetsAt` as the current reset.

## Proof in a disposable database

`node scripts/performance/isolated-command.mjs npx vitest run --config vitest.db.config.ts __tests__/db/free-monthly-period-end.dbtest.ts` replays the full migration chain into a local PostgreSQL cluster and checks: all twelve months, December to January, leap-year February, instants either side of IST midnight, four session time zones, a new debit under a non-UTC session zone, the backfill on zero/one/full rows, weekly and anomalous rows left unchanged, receipts and snapshots unchanged, and a second run changing nothing. Before the migration existed, the same test showed a new October debit storing `2026-10-30T18:30Z`.

## Before applying (read-only, on the approved target)

1. Record the applied migration list and the live `commit_free_calculation` definition (`pg_get_functiondef`).
2. Record the policy pointer, the policy versions in use and their zones, and the retention job state:

```sql
SELECT r.policy_version, p.version, p.period_unit, p.time_zone, p.monthly_limit
FROM public.free_rollout r CROSS JOIN public.free_quota_policies p ORDER BY p.version;

SELECT u.policy_version, p.period_unit, count(*) FROM public.free_monthly_usage u
LEFT JOIN public.free_quota_policies p ON p.version = u.policy_version GROUP BY 1, 2 ORDER BY 1;

SELECT jobname, active, schedule FROM cron.job WHERE jobname = 'weavly-free-retention';
```

3. Capture the rows the backfill will change, with old and new values, into an access-controlled change record. This is also the rollback mapping:

```sql
SELECT u.subject_id, u.period_start, u.period_end AS old_period_end,
  (date_trunc('month', u.period_start AT TIME ZONE p.time_zone) + interval '1 month') AT TIME ZONE p.time_zone AS new_period_end
FROM public.free_monthly_usage u
JOIN public.free_quota_policies p ON p.version = u.policy_version
WHERE p.period_unit = 'month'
  AND u.period_start = date_trunc('month', u.period_start AT TIME ZONE p.time_zone) AT TIME ZONE p.time_zone
  AND u.period_end IS DISTINCT FROM (date_trunc('month', u.period_start AT TIME ZONE p.time_zone) + interval '1 month') AT TIME ZONE p.time_zone
ORDER BY u.period_start, u.subject_id;
```

Expected: only rows whose IST month is March, May, July, October or December, each moving later by one to three days. Stop and review anything else.

4. List anomalies the backfill deliberately skips (unknown policy, or a month-policy row that does not start a local month):

```sql
SELECT u.subject_id, u.period_start, u.period_end, u.policy_version
FROM public.free_monthly_usage u
LEFT JOIN public.free_quota_policies p ON p.version = u.policy_version
WHERE p.version IS NULL
   OR p.period_unit = 'month' AND u.period_start <> date_trunc('month', u.period_start AT TIME ZONE p.time_zone) AT TIME ZONE p.time_zone;
```

5. Fingerprint the protected columns and the other tables:

```sql
SELECT md5(string_agg(concat_ws(':', subject_id, period_start, policy_version, allowance, used), ',' ORDER BY subject_id, period_start)) AS usage_fingerprint,
  (SELECT count(*) FROM public.free_calculation_receipts) AS receipts,
  (SELECT count(*) FROM public.free_saved_costings) AS snapshots
FROM public.free_monthly_usage;
```

## Apply

Through the normal migration process, in the approved window. Do not activate or reschedule retention in the same change.

## After applying

- The query in step 3 returns no rows.
- Step 5 returns the same fingerprint and counts.
- One authorized synthetic Free calculation returns `resetsAt` equal to `/api/free/status` `quota.resetsAt`.

## Rollback

The corrected values are right, so reversal should rarely be needed. If the application path is unsafe, pause new Free estimation with `free_rollout.estimation_enabled = false`. Saved history and PDFs stay available. To restore old values, use the captured mapping and only touch rows still holding the new value:

```sql
UPDATE public.free_monthly_usage u SET period_end = m.old_period_end
FROM (VALUES /* captured (subject_id, period_start, old_period_end, new_period_end) */) AS m(subject_id, period_start, old_period_end, new_period_end)
WHERE u.subject_id = m.subject_id::uuid AND u.period_start = m.period_start::timestamptz AND u.period_end = m.new_period_end::timestamptz;
```

Never lower `used`, reset a month or delete receipts or snapshots to reverse metadata. Keep the migration in history and correct forward if needed.

## Production application record

Project `vzhw…` (production), 2026-10-04, owner-requested after PR #181 merged.

**Preflight** (read-only, 2026-10-03 19:21 UTC):
- **Live function:** `commit_free_calculation` body MD5 `ad27102cf63262c7880d6a88370de63a`, identical to `20260912130854_free_monthly_allowance.sql`. Config `search_path=pg_catalog, public`, `TimeZone=UTC`, `SECURITY INVOKER`. EXECUTE granted to `service_role` and `postgres`.
- **Policy:** rollout on version 2 (monthly, Asia/Kolkata, limit 2), estimation enabled. `weavly-free-retention` inactive.
- **Rows to change:** none. The two usage rows were September 2026 (monthly, already correct) and one historical weekly row.
- **Anomalies:** none.
- **Rollback mapping:** empty.
- **Fingerprints:** usage `69c9f9b9675fc930d2ecd4b56e0b947d`, 1 receipt, 1 snapshot, snapshots `2c2b3c58248f3a7e8ac264a61a8f7627`.

**Apply:** the merged file was run in one transaction through the Supabase MCP `execute_sql` tool, with a `supabase_migrations.schema_migrations` row for version `20261004090000` (`free_monthly_period_end_local_month`). The MCP `apply_migration` tool was not used because it records the apply time as the version.

**After:**
- **Function:** body MD5 `a42770ec1630957f5f12592bb0b6d01f`, matching the merged file. Same config, security mode and grants. `free_local_month_end` has EXECUTE for `service_role` (and `postgres`) only, with `search_path=""`.
- **Month ends:** `free_local_month_end` gives 31 Oct 18:30 UTC for October and 31 Mar 18:30 UTC for March. The current month ends 31 Oct 18:30 UTC.
- **Backfill:** zero rows left to change.
- **Fingerprints, receipts and snapshots:** unchanged.
- **Retention:** still inactive.

Not done: the post-apply synthetic Free calculation comparing `resetsAt` with `/api/free/status`. No Free costing has run in October yet.

