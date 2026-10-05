# Lite mobile redesign checkpoint

Free was pushed and merged through [PR #189](https://github.com/Rajp2002/TextileAccounting/pull/189), merge `34f37ce223ecd321c1c046901384175ca118b04a`. Both merged-main GitHub jobs passed in [run 37367845711](https://github.com/Rajp2002/TextileAccounting/actions/runs/37367845711). Earlier main database-job attempts failed while obtaining a runner; the final retry actually ran and passed the database suite. The PR checks and preview passed before merge. No direct deployment command or production data/migration operation was performed.

Lite is on local branch `codex/lite-mobile-redesign`. Its application commits are `d342301353849ebf3b17a00af0b8619c2c962d2f` and `edc8571e05522588e680620add984d755aaa5fda`; `4201e9be` updates retained-layout, access and sample-data contract tests. Application content is unchanged after `edc8571e`. Lite has not been pushed or published. Base requires a separate approval.

## Result and coverage

Lite now reaches the costing task sooner: Quick/Detailed, entitled Saved qualities, loaded recipe/version identity and readiness precede the inputs. In matching synthetic fixtures the first required input moved from y621 at320 pixels and y588 at390/430 to y373; desktop remains y455. Optional instructions stay mounted behind Help. Paid live costing, existing scoped local draft recovery and immutable factory-version save remain distinct. The bottom review action reports live/dirty/saved/uncertain truth and measures its own clearance using the existing viewport and keyboard infrastructure. The in-place Free upgrade still disables autosave and gains no durable draft promise.

Saved Costings and Rate Book lead with search, records and review-due tasks. Counted filters retain state; comparison, archive and version/source identity remain deliberate. Existing entitled Free receipts use one mounted, error-revealing disclosure. Narrow Lite mobile guards suppress duplicate rate/library requests while retaining original proposals and concurrency tokens for retry.

Settings uses mounted summaries/editors that preserve dirty inputs and expose errors. Billing keeps payment attention, original order recovery, price/tax/renewal terms and receipt truth visible. Historical unresolved Lite attempts can use the existing reconciliation endpoint without starting another payment. Exact deletion identity and typed confirmation are protected from translation across tiers; existing deletion rules remain intact. Audit, export, Lite plans/signup and customer support receive scoped compact presentation. The shared receipt-only pilot policy already resolved the GST-invoice copy conflict in Free; no commercial decision is outstanding.

The full disposition of all67 UI entrypoints is retained in [FREE-routes.json](FREE-routes.json); [LITE.md](LITE.md) maps Lite coverage and deferrals. Route-specific details and evidence are in [LITE-records.md](LITE-records.md) and [LITE-supporting.md](LITE-supporting.md). Base navigation, estimator composition, production, Daily Sheet, assignments, machines/workers/payroll, stock/dispatch and six-stage onboarding are deferred. Marketing and privileged founder administration remain excluded.

## Verification ledger

Final aggregates run in a clean source snapshot with a fresh lockfile install and no `.env` files, ignored worktrees, scratch copies or stale Next types. The repository isolation wrapper blanks hosted credentials and points Supabase to closed localhost port9. Database tests create and destroy disposable loopback PostgreSQL; no production migration is applied. The source/evidence manifest and logs are under `output/playwright/lite-mobile-redesign/validation/`.

| Status | Check | Result |
| --- | --- | --- |
| Passed | Type checking | `npx tsc --noEmit`, exit0 |
| Passed | Full lint | `npm run lint`, zero errors/warnings |
| Passed | Full unit/contract gate | 325 files;2988 passed,1 intentionally skipped live-Supabase test |
| Passed | Disposable database aggregate | 32 files;273 passed, exit0 |
| Passed | Production build | `npm run build`, including the full unit gate and Next TypeScript;52 pages generated, exit0 |
| Passed | Local production public smoke | Seven read-only routes,320/430/1440 and320 computed text200%; exit0, no external or mutation requests |
| Passed | Lite estimator browser | 24/24 groups against `edc8571e`;36 enlarged-text scenes,27 touch scenes,3 notice/dialog paint-order probes; all15 enlarged dialog footers/actions/Close remain reachable by scrolling |
| Passed | Lite records browser | 13 flow groups;27 EN/HI/GU320px text200% scenes;2 Free-history checks |
| Passed | Lite supporting browser | 99 behavior assertions;30 EN/HI/GU320px text200% scenes |
| Passed | Final Free browser regression | 19/19 groups after the last application change, including metered save/correction/upgrade and24 estimator+12 history enlarged-text scenes |
| Passed | Fresh independent reviews | Records owner reviewed estimator/mobile CSS; estimator owner reviewed supporting; supporting owner reviewed records. No unresolved actionable findings |
| Failed earlier, resolved | First full unit gate | Seven old markup/Free-only/handler-scope assertions updated to retain desktop rails, sample guards and verified-tier access semantics; final full suite passes |
| Failed earlier, resolved | Browser findings | Duplicate rate/library/default requests, translated reflow/unit gutters, focus and long-success-notice review overlap corrected; final slice reruns pass |
| Unrun | Installed devices/integration | Installed iOS/Android PWA, real keyboard/safe areas/gestures/lifecycle, hosted auth/payment outcomes, device file delivery and native-speaker copy review |

Browser emulation mounts real app components with synthetic localhost action answers and remote requests blocked. It checks the client response to uncertain outcomes and retries; hosted transaction/security/provider guarantees are covered only to the extent of existing unit and disposable database tests. It does not establish live provider behavior. Actual computed fonts and numeric line heights are doubled, including fixed-pixel labels; viewport and layout dimensions stay320 pixels. Direct text/clip/overlap/native-value/unit checks supplement screenshots. Reachable controls use44-pixel hit regions. Simulated visualViewport changes exercise the real keyboard observer/accessory; no software keyboard was opened on a physical device. The production smoke checks use the built Next app only for public pages; authenticated fixtures do not establish full production Next-shell integration.

## Before and after

Estimator BEFORE is an immutable Git archive of merged Free `34f37ce2`, using the same corrected synthetic profile and actual app Toaster as final AFTER. Records/supporting BEFORE captures precede their edits; the additional prior-Free baseline is explicitly reconstructed from immutable route clients. System font fallbacks, viewport, synthetic data and capture conditions are documented by each fixture. Full-page fixed-dialog captures are supplemented by viewport captures and direct bounds checks.

| Scene | Before | After |
| --- | --- | --- |
| Estimator320 | [Before](../../output/playwright/lite-mobile-redesign/estimator/before/lite-estimator-320x568-synthetic.png) | [After](../../output/playwright/lite-mobile-redesign/estimator/after/lite-estimator-320x568-synthetic.png) |
| Estimator430 | [Before](../../output/playwright/lite-mobile-redesign/estimator/before/lite-estimator-430x932-synthetic.png) | [After](../../output/playwright/lite-mobile-redesign/estimator/after/lite-estimator-430x932-synthetic.png) |
| Estimator desktop | [Before](../../output/playwright/lite-mobile-redesign/estimator/before/lite-estimator-1440x900-synthetic.png) | [After](../../output/playwright/lite-mobile-redesign/estimator/after/lite-estimator-1440x900-synthetic.png) |
| Saved Costings320 | [Before](../../output/playwright/lite-mobile-records/before/quotes-lite-320.png) | [After](../../output/playwright/lite-mobile-records/after/quotes-lite-320.png) |
| Rate Book430 | [Before](../../output/playwright/lite-mobile-records/before/rates-lite-430.png) | [After](../../output/playwright/lite-mobile-records/after/rates-lite-430.png) |
| Settings320 | [Before](../../output/playwright/lite-mobile-supporting/before/settings-320.png) | [After](../../output/playwright/lite-mobile-supporting/after/settings-320.png) |
| Billing430 | [Before](../../output/playwright/lite-mobile-supporting/before/billing-430.png) | [After](../../output/playwright/lite-mobile-supporting/after/billing-430.png) |
| Settings desktop | [Before](../../output/playwright/lite-mobile-supporting/before/settings-1440.png) | [After](../../output/playwright/lite-mobile-supporting/after/settings-1440.png) |

[Estimator contact sheet](../../output/playwright/lite-mobile-redesign/estimator/comparison/lite-mobile-before-after.png). Superseded diagnostic PNGs were moved to session-local `/tmp/weavly-lite-diagnostics`; a hash/index and their JSON/logs remain in the evidence directory. Canonical before/after screenshots and final reports are retained. Preliminary fixture failures are explicitly excluded from pass claims; no failed final evidence was removed.

Initial estimator controls are pixel-identical for nine Free/Base/Lite-desktop pairs; records controls are identical for ten desktop/Base/default pairs. Supporting desktop layout/text is preserved: five of six route captures are identical, with255 Billing shadow pixels changing by at most5 channel levels. Twelve Base supporting and three Free account captures are identical. Base signup desktop is identical; its small-screen eye icon differs by13/10 raster pixels. The prior-Free desktop comparison uses a separately labelled reduced-motion after capture because the first default-motion capture faded. These bounded comparisons do not claim every desktop state is identical. The intentionally shared correction protecting deletion literals and Lite payment outcome truth is described above.

## Remaining work and proposed Base scope

No unresolved redesign defect was found by the completed slice checks or fresh reviews. The existing audit date filter uses device-local midnight while displayed timestamps use Asia/Kolkata; its query semantics were preserved. Resolve its timezone contract separately. Device and hosted integration QA listed above remains unrun.

After explicit Base approval, apply M01–M03 to Base's domain navigation, compact costing section selection, estimator and entitled records/rates; implement M04 production/Daily Sheet/assignments, M05 stock/dispatch and M06 workforce/payroll; complete M07 six-stage onboarding and Base supporting surfaces. Carry M00/M08 through each increment with baseline screenshots, translated320px/text200% checks, keyboard/focus/interruption testing and Free/Lite/desktop regression. Preserve accounting/payroll/inventory/auth/deletion contracts and keep existing domain defects separate from layout changes.

Stop at this Lite checkpoint. Base implementation and Lite publication need the user's next instruction.
