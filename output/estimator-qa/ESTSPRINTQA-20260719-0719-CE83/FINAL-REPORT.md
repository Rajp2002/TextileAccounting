# Estimator Readiness Remediation Sprint Report

Run ID: `ESTSPRINTQA-20260719-0719-CE83`
Date: 19 July 2026
Environment: local production-mode application bound exclusively to QA Supabase
QA project: `eutycrtzzxmlkcpipgod`
Repository base: `00bd5711c190` on `codex/repository-grounded-architecture-enhancement`
Accounts: disposable Base owners and tenants for the main run, blocker closure, and physical-iPhone pass; all deleted after testing
Production mutations: none

## Decision

**Code and QA candidate: Go. Manual matrix certification: Complete. Production deployment smoke: Pending.**

The sprint removed every reproducible product failure from the source run. Follow-up testing closed the two exact Chrome zoom rows, the installed-PWA row on Google Chrome 150, and the physical-iPhone Safari row. The current matrix is **24 Pass, 0 Fail, 0 Blocked** across Steps 5-28. The earlier Base presentation regression also passes.

The physical-device pass exposed two real iOS-only defects before closure. Saving silently failed on insecure LAN Safari because `crypto.randomUUID()` was unavailable; the request-ID generator now has standards-compatible secure and legacy fallbacks. Text inputs also triggered Safari focus zoom; Estimator text controls now use a scoped 16 px minimum on mobile. After rebuilding and reloading, physical Safari saved successfully, reopened the costing, kept fields and actions reachable above the keyboard, dismissed the keyboard with Done, and retained zero horizontal overflow.

## Sprint outcome

| Ticket | Result | Runtime outcome |
| --- | --- | --- |
| EST-RDY-00 | PASS | QA was brought to exact candidate migration parity: 213 matched, 0 QA-only, 0 local-only. QA provisioning smoke passed. |
| EST-RDY-01 | PASS | Negative, blank, oversized, excessive-precision, non-finite, and tampered numeric inputs are rejected or normalized. Totals pause and actions explain why they are unavailable. |
| EST-RDY-02 | PASS | `Open & Update` restores the saved costing immediately. No extra `Load Specs` action appears. Updates retain the same row ID. |
| EST-RDY-03 | PASS | `/owner/today`, Machines, Payroll, and Analytics show the Base upgrade wall without exposing Premium data. Return, Back, and refresh behave correctly. |
| EST-RDY-04 | PASS | `Start Party Order` is absent from Base desktop and mobile layouts. |
| EST-RDY-05 | PASS | Real Chrome reported exact 1.25 and 1.50 zoom signals. Both levels had zero horizontal overflow; Save, Settings, and Logout remained reachable, including through the 150% responsive menu. |
| EST-RDY-06 | PASS | Physical iPhone Safari passed navigation, portrait layout, text and numeric keyboard behavior, Ne/denier conversion, calculation, save, reopen, quality-action visibility, and Settings reachability without blocking overflow or action occlusion. |
| EST-RDY-07 | PASS | Weavly was installed as a real Chrome desktop PWA. Initial open and cold relaunch both reported standalone display mode, restored authenticated `/owner/estimator`, had no overflow or console issues, and the app was uninstalled afterward. Earlier update acceptance and repeated no-loop reload checks also passed. |
| EST-RDY-08 | PASS | Offline existing update and new save showed truthful failure, preserved drafts, made no server write, and succeeded exactly once after reconnect. |
| EST-RDY-09 | PARTIAL | Full automated suite, build, QA regression, physical-device certification, reconciliation, and cleanup passed. The exact merged candidate still needs its deployed-production smoke and cleanup proof. |

An additional runtime finding was fixed during the sprint: an invalid Supabase refresh-token cookie could trap a returning browser at sign-in. Credential login, middleware, and signout now expire stale auth-cookie chunks. A deliberately seeded stale cookie was removed, and the same disposable owner then signed in successfully to `/owner/estimator`.

## Manual matrix

| Step | Area | Result | Evidence |
| ---: | --- | --- | --- |
| 5 | Basic calculation | PASS | 40 Ne converted to 132.875 D; 1,000 m tape with 5% crimp showed about 952 m cloth/beam; Water Jet 700 RPM, 60 picks, 12 h, 85% showed 181 m/machine/day; no NaN or Infinity. |
| 6 | Invalid inputs | PASS | Negative rate/width, blank required rate, `999999999999`, and `250.123456789` produced field errors, `aria-invalid=true`, paused results, and disabled Save. Letters/comma were rejected by the browser; spaced `250` visibly normalized to `250`. Correcting the value restored calculation and Save without refresh. |
| 7 | Initial save | PASS | Exactly one `estimator_quotes` row, one warp row, one weft row, 1,000 m tape, 1,000 m quantity, and a client request ID. |
| 8 | Refresh/reopen | PASS | `Open & Update` landed on a populated form with rate 250, `Update Costing`, and no `Load Specs`. |
| 9 | Update | PASS | Rate 250 → 260 updated the same row ID and timestamp; count stayed one. |
| 10 | Rapid update | PASS | Double-click update to 261 retained one row and the original ID. |
| 11 | Logout/sign-in persistence | PASS | Native logout returned to login; fresh sign-in returned the Base owner to Estimator with the saved costing intact. |
| 12 | Create quality | PASS | One active saved quality with one warp and one weft layer and the current rate snapshot. |
| 13 | Update quality | PASS | Original quality rate updated to 263 on the same ID. |
| 14 | Normalized duplicate prevention | PASS | Leading spaces and lowercase duplicate name were rejected with linked inline feedback; editing the name cleared the error. |
| 15 | Intentional quality copy | PASS | Separate copy created and independently updated to 264 while the original remained 263. |
| 16 | Delete quality copy | PASS | Cancel preserved the copy; confirm made only the copy inactive. |
| 17 | Base Settings | PASS | Business/profile, privacy export, Estimator defaults, saved qualities, billing, and password/security were present. Premium join-code, production-mode, supervisor, and WhatsApp controls were absent. |
| 18 | Reversible setting | PASS | Default commission changed 2% → 3%, survived reload and database verification, then returned to 2% in UI and database. |
| 19 | Premium route wall | PASS | Today, Machines, Payroll, and Analytics stayed on their deep link and showed the Full Suite wall. Today Return, Back, and refresh passed. |
| 20 | Chrome 125% | PASS | Real Chrome reported `devicePixelRatio = 1.25` and matched `1.25dppx`. The effective viewport was 768 px; document and body scroll widths equalled their client widths. Save Costing, Settings, and Logout were all within the viewport. |
| 21 | Chrome 150% | PASS | Real Chrome reported `devicePixelRatio = 1.50` and matched `1.5dppx`. The effective viewport was 640 px with no horizontal overflow. The responsive navigation dialog fit without internal scrolling; Settings navigation reached `/owner/settings`, and Logout was within the dialog viewport. |
| 22 | iPhone Safari | PASS | On a physical iPhone, mobile navigation passed and the Estimator had no horizontal overflow. `40 Ne` converted to `132.875 D`; numeric inputs stayed visible above the keyboard and Done dismissed it. `1,000 m` tape showed about `952 m` capacity and `2` beams. After the UUID fallback fix, Save created the costing, reopen restored it, and the mobile quality action and Settings remained reachable. A scoped 16 px mobile text-control rule removed Safari focus zoom on final retest. |
| 23 | Installed PWA | PASS | Chrome installed Weavly as a desktop PWA. Initial open and a separate cold launch both reported `display-mode: standalone`, not browser/minimal UI, restored the authenticated `/owner/estimator` route, had no horizontal overflow, and logged no console warnings/errors. The app was signed out and uninstalled. This complements the earlier one-time update acceptance and two no-loop reload checks. |
| 24 | Offline existing update | PASS | Rate 261 → 262 remained editable; no success or redirect occurred; the database stayed at 261 and one row while offline. |
| 25 | Reconnect/retry | PASS | Retry updated the original row to 262; ID and count remained unchanged. |
| 26 | Offline new save | PASS | Offline save created zero rows and preserved the draft. Reconnect plus rapid retry created exactly one new row with a client request ID; UI deletion returned its count to zero. |
| 27 | Final clean login | PASS | Estimator, Saved Costings, Settings, quality, Base navigation, service worker, and cache privacy passed with no console issues or failed application requests. |
| 28 | Cleanup | PASS | Tenant data, inactive quality history, subscription, profile, organization, auth user, cost profile, referrals, and deletion audit residue all reconciled to zero. The follow-up blocker-closure tenant also reconciled to zero across all 68 live tenant-scoped tables. |

## Database invariants

Before final cleanup:

| Resource | Count |
| --- | ---: |
| Organization | 1 |
| Profile | 1 |
| Subscription | 1 |
| Costings | 1 |
| Saved qualities, including inactive copy | 2 |
| Factory cost profile | 1 |
| Audit rows | 16 |
| Orders, machines, workers, production, market runs, parties, payroll, advances, dispatches, stock lots, receivables | 0 each |

After cleanup:

| Resource | Count |
| --- | ---: |
| Organizations matching the run prefix | 0 |
| Profiles matching the disposable email | 0 |
| Auth user | 0 |
| Subscriptions | 0 |
| Costings matching the run prefix | 0 |
| Quality rows matching the run prefix, including inactive history | 0 |
| Factory cost profile | 0 |
| Referral codes | 0 |
| Audit rows | 0 |
| All checked Premium/business tables | 0 |

The profile and organization deletions produced two final audit rows; those were explicitly removed and the second reconciliation returned all zero.

The follow-up blocker-closure tenant initially contained one organization, one profile, one Base subscription, one factory cost profile, one referral code, and three audit rows; the other live tenant-scoped tables were empty. After teardown, all **68** tenant-scoped tables returned zero matching rows with zero query errors, and the organization, profile, Auth user, installed app bundle, and app process were absent.

## Automated and build evidence

- Full repository suite: **103 files passed; 729 tests passed; 1 skipped**.
- TypeScript: `npx tsc --noEmit` passed.
- Targeted ESLint across Estimator, PWA, auth recovery, and tests passed.
- `git diff --check` passed.
- Final production-mode QA build passed.
- Build artifact scan: QA project reference present in 36 non-development artifact files; production reference present in 0.
- Generated service worker: five `NetworkOnly` dynamic-response routes; zero `start-url` cache markers; static assets and the offline fallback remained cached.
- Final source link was restored from QA to the production Supabase project after testing.

## Implemented remediation

- Shared live/server numeric validation and accessible field errors.
- Safe result-pausing and action explanations.
- Immediate saved-costing restore with conflicting-draft confirmation.
- Base-only removal of the Premium order action.
- Data-driven Premium route-gate regression coverage.
- Persistent offline banner, immediate draft flush, truthful retry guidance, and request-ID replay protection.
- Base PWA start route and one-time update notification guard.
- Network-only caching for authenticated documents, RSC, Next data, and API GET responses.
- Stale Supabase session-cookie recovery for login, middleware, and signout.
- Missing production migration `20260715113013_harden_summary_views_security_invoker.sql` recovered locally and applied to QA during parity repair.
- Browser-safe UUID request IDs for insecure/legacy Safari, including a standards-compatible fallback when Web Crypto UUID APIs are unavailable.
- Scoped 16 px mobile Estimator text controls to prevent iOS Safari focus zoom without changing numerical control behavior elsewhere.
- A compact, accessible mobile `New Quality` action so saved-quality creation remains reachable on narrow screens.

## Evidence files

- `step05-valid-calculation.png`
- `step06-invalid-blocked.png`
- `step08-immediate-restore.png`
- `step19-today-upgrade-wall.png`
- `step-125-proxy.png`
- `step-150-proxy.png`
- `step20-chrome-125-exact.png`
- `step21-chrome-150-exact.png`
- `step22-mobile-menu.png`
- `step22-mobile-estimator.png`
- `step22-iphone-lan-save-fixed.png`
- `step22-iphone-final-actions.png`
- `step23-installed-pwa-open.png`
- `step23-installed-pwa-cold-launch.png`
- `step24-offline-update-blocked.png`
- `step27-final-clean-login.png`

## Remaining release actions

1. Deploy the exact merged candidate before production smoke. A smoke against an older build would not certify these fixes.
2. Run a disposable Base-account production save/reopen smoke, reconcile it to zero, and record the exact deployment identity.

No product failure or manual-matrix blocker remains open from the source run. Release sign-off remains pending only until this exact candidate receives its deployed-environment smoke test and disposable-data cleanup proof.
