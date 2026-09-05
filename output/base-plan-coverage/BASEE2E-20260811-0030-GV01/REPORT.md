# Weavly Base Plan — production readiness, value, pricing, and referral report

**Run:** `BASEE2E-20260811-0030-GV01`  
**Production URL:** https://textile-accounting.vercel.app  
**Completed:** 12 August 2026 (IST)  
**Production commit at close:** `2e12978ef7c279f73f375419e9435a5072d73018`  
**Decision:** **NO-GO for an unrestricted production launch. Conditional GO for a small, closely supported owner pilot after the P0 fixes below.**

## Executive conclusion

The Base Plan's main product promise is valuable and the production owner journey works: an owner can capture a grey-fabric quality, maintain current yarn rates, reopen that quality with current rates, preserve the old commercial snapshot, save a new version, understand the price delta, and produce internal and customer-safe documents. The tested QA quality moved from INR 45.20/m cost and INR 53.07/m selling price in v1 to INR 45.67/m and INR 53.60/m in v2 after the weft rate changed from INR 236/kg to INR 244/kg. Browser state and tenant-scoped database rows agreed.

That is a credible, weaving-specific value loop. It is stronger than a generic ledger or billing tool for the proprietor who currently relies on memory, spreadsheets, WhatsApp, or a clerk to explain why a repeat quality's price changed.

The whole product is not production-ready today. The live database is behind the application by three migrations. The missing `referral_year_credits` table makes the referral panel unavailable and directly causes organization export to fail. The Base-only commercial rollout is also not enforced by the checkout API, four high-severity production dependency advisories remain, and Supabase reports a large untriaged security-hardening backlog. These issues are especially damaging to referral-led growth because a proprietor risks personal reputation when recommending software to another mill owner.

This run recorded **31 browser/database passes, 3 code-verified items, 1 explicit matrix failure, and 30 not-run items** out of the historical 65-item matrix. The not-run set includes live money failure/cancellation scenarios and other destructive or specialized boundaries; it must not be represented as fully cleared.

## Production decision and blockers

### P0 — fix before any public launch or referral campaign

1. **Deploy and verify the missing production migrations.** Production stops at `20260808121531_harden_quotation_sent_stamp_search_path`; the checkout has three newer migrations:

   - `20260809193000_zero_warp_crimp_defaults.sql`
   - `20260809193305_sprint21_sync_saved_quality_yarns_to_rate_book.sql`
   - `20260810182342_referral_year_credits.sql`

   The current Vercel deployment is healthy and matches the checkout commit, so the critical drift is the database, not the web deployment.

2. **Restore organization data export.** Production returned `No export was generated`. Vercel runtime evidence names the exact cause: PostgREST error `PGRST205`, because `public.referral_year_credits` is absent from the schema cache. This violates the product's data-portability and cancellation promise.

3. **Make referral runtime functional and prove it end to end.** The paid Base owner's Billing page currently shows `Referral details are temporarily unavailable`. Apply the migration, then test code creation, valid attribution, invalid/retired code feedback, self-referral rejection, duplicate/idempotent attribution, paid conversion, five-credit cap, and final-30-day redemption with isolated fixtures.

4. **Enforce Base-only checkout on the server.** Public copy and configuration say Full Suite is unavailable, but `app/api/billing/create-order/route.ts` defaults a missing `planTier` to `premium` and accepts both `base` and `premium`. A caller must not be able to create a Full Suite order during a Base-only rollout.

5. **Remediate or explicitly accept production dependency risk.** `npm audit --omit=dev` reports six production findings: four high and two moderate, including `brace-expansion`, `fast-uri`, `nanoid`, and the `dompurify` dependency used through `jspdf`. Apply compatible updates and rerun tests/build/audit; do not use an unreviewed forced downgrade.

### P1 — close before scaling beyond a supervised pilot

- **Triage the live Supabase security advisor findings.** The advisor reports 95 security notices: 90 warnings and 5 informational items. These include 25 mutable function search paths, 63 signed-in-callable `SECURITY DEFINER` RPC warnings, one anonymous-callable definer warning, and leaked-password protection configuration. Some definer RPCs may be intentionally exposed and internally tenant-guarded; the advisor result is not by itself proof of an exploit. Each exposed Base RPC—saved-quality creation/revision, yarn discovery, account deletion, exports, billing, and referrals—needs an explicit grant/tenant/auth audit and negative test. [Supabase linter remediation](https://supabase.com/docs/guides/database/database-linter)
- **Finish Gujarati/Hindi localization.** Gujarati mode contained mixed-language fragments such as English operational terms embedded in Gujarati sentences. For the target owner persona, that looks unfinished and increases misunderstanding around costing and commercial decisions.
- **Fix the misleading historical-version action.** Directly editing opened v1 and choosing `Save New Version` produced a duplicate-quality error. The documented Rate Book → reopen current quality → save snapshot path succeeded, but the competing button promise creates avoidable uncertainty.
- **Reconcile organization metadata.** The Base QA organization renders the correct Base experience and has a Base subscription, but its database profile still says `product_experience=full_suite` and `onboarding_complete=false`.
- **Clear the remaining P0/P1 matrix boundaries.** Priority gaps include password reset enumeration, live failed/cancelled checkout recovery, runtime webhook idempotency, stale two-tab writes, extreme numeric inputs, default/optional-setting persistence, service-worker export freshness, and account deletion/data retention.

## What passed in production

### Authentication and plan boundary

- Neutral invalid-login handling and valid owner login passed.
- Logout passed, including cross-tab propagation: after logout in one tab, a second protected Settings tab redirected to `/login` on reload.
- Base navigation exposed only Cost Estimate, Yarn Rate Book, Saved Costings, Settings, and Billing.
- Full Suite routes such as Orders, Production, Payroll, and Today returned safely to the Base estimator with no premium data leakage.
- Public landing, Terms, Privacy, and Refund pages loaded and agreed on Base scope, one-factory access, manual renewal, and pricing.

### Owner golden journey

The tested owner journey used `BASEE2E-20260811-0030-GV01-GREY-150D`:

1. Built a complete 150D grey-fabric estimate with warp/weft, waste, crimp, preparation, overhead, commission, transport, margin, and quantity.
2. Verified blank-name and negative-rate validation prevented bad writes.
3. Saved one reusable quality and immutable v1 costing.
4. Confirmed warp INR 224/kg and changed weft INR 236/kg → INR 244/kg in the Rate Book.
5. Reopened the quality using current rates while v1 stayed frozen.
6. Saved v2 at quantity 6,000m.
7. Compared v1 and v2: cost +INR 0.47/m and selling price +INR 0.53/m, with margin unchanged at 10%.
8. Archived and restored v1 through explicit confirmations.
9. Generated an internal cost estimate and previewed/downloaded a customer quotation.

Production records confirmed one template, current rate rows plus history, and exactly two costing snapshots in one lineage. No application console error/warning burst appeared during the core path.

### Customer-safe output and mobile use

- The customer quotation contained party, quality, quantity, rate, value, validity, and a not-a-tax-invoice notice.
- It did not expose internal production cost, break-even, margin, profit, yarn rate, or overhead.
- Estimator, Rate Book, and Settings had no horizontal overflow at 390 × 844 and retained usable primary actions.
- Settings now renders, closing the prior blank-controls regression.

### Billing truth

The QA organization shows active Base access through 3 August 2027 IST, backed by a captured INR 8,260 Netbanking payment. Billing truthfully shows manual renewal at INR 2,360 in the final 30 days, no automatic charge, and distinguishes the payment receipt from a GST tax invoice.

No new real-money order or destructive account mutation was created during this test.

## Persona-based value assessment

| Persona | Current value | Finding |
| --- | --- | --- |
| Proprietor / commercial decision-maker | **Strong after reliability fixes** | The current-rate → immutable-history → explainable-price-delta loop directly supports repeat-quality pricing and customer negotiation. This is Base Plan's best fit. |
| Owner operating on mobile | **Good** | Core screens worked at 390px and the simplified navigation is appropriate. Mixed Gujarati/English and the failed export reduce confidence. |
| Commercial assistant / supervisor | **Weak-to-moderate** | Base is owner-only and legal terms prohibit shared credentials. There is no delegated limited-access workflow. This is acceptable only if Base is explicitly sold as one owner's costing desk. |
| CA / accountant | **Supporting value only** | Exportable cost records and payment history help, but Base is not accounting/GST software and the receipt is not a GST invoice. Do not sell it as a replacement for Tally, Zoho Books, or a CA workflow. |
| Industry peer acting as referrer | **Not recommendable today** | Referral is unavailable, data export fails, and localization is unfinished. The reputational downside outweighs the deferred reward. |
| Referred mill owner | **Weak referral proposition** | The friend pays the full INR 8,260 and receives no explicit referral benefit or attribution confirmation. The current design mainly rewards the referrer. |

## Is the product valuable enough to pay for?

**The product has a credible paid value proposition, but willingness to pay has not been proven by this QA run.** One paid QA subscription proves billing plumbing and entitlement state; it does not prove market demand, conversion, retention, or referral intent.

The strongest value claim is not “software for a textile business.” It is: **use current yarn rates to price a repeat grey-fabric quality, preserve what was quoted before, and show exactly why today's selling price changed.** An owner will pay when that loop prevents one underquoted order, shortens a customer-pricing decision, or replaces fragile spreadsheet/memory dependence. The export failure is therefore serious: data control is part of the trust exchange.

Required commercial proof before claiming product-market readiness:

- 8–12 target owners completing the same journey with their own qualities and rates;
- at least 5 owners using it independently for four consecutive weeks;
- observed time-to-first-trusted-costing and weekly repeat use;
- documented avoided pricing error or decision-time saving;
- price interviews using real checkout choices, not only “would you pay?” questions;
- 30/60-day retention and an unaided referral-intent question after a successful value milestone.

## Pricing and market-penetration assessment

Current Base pricing is **INR 8,260 including GST for year one** (INR 7,000 + GST), or about **INR 688/month gross equivalent**. Renewal is **INR 2,360 including GST**, or about **INR 197/month gross equivalent**.

That is a credible penetration position:

- It is above the free/low-price generic floor: Khatabook is free; Vyapar advertises about INR 242/month; BUSY has a free tier and paid entry around INR 417/month; Zoho Books has a revenue-limited free plan. [Khatabook](https://khatabook.com/en/), [Vyapar](https://vyaparapp.in/pricing-detail), [BUSY](https://busy.in/pricing/), [Zoho Books India](https://www.zoho.com/in/books/pricing/)
- It is below or around specialist textile entry pricing: Fabric Square is about INR 799/month annually and UGAAN starts at INR 999/month. [Fabric Square](https://fabricsquare.in/), [UGAAN ERP](https://erp.ugaan.in/)
- It is near mainstream paid accounting tools such as TallyPrime at INR 750/month or INR 8,100/year, while serving a narrower but more weaving-specific costing job. [TallyPrime](https://tallysolutions.com/tallyprime-accounting-software-free-trial/)

**Recommendation:** keep the INR 8,260 first-year price for the pilot; do not cut it merely to look cheap. The vertical workflow justifies the premium over a generic ledger if it is reliable. Keep the INR 2,360 renewal only after checking support and hosting unit economics—it is already exceptionally aggressive. A lower price will not cure trust failures and could position the product as disposable.

Use a no-card guided sandbox or short trial to reduce adoption risk. Compete on fast time-to-trusted-costing, local support, immutable history, and safe customer output rather than on the lowest sticker price.

## Referral scheme assessment

The intended scheme requires an active, fully paid Base referrer. The referred organization pays the full first-year amount; after paid conversion the referrer earns one noncash Base renewal year worth INR 2,360, capped at five credits (INR 11,800 nominal). A credit is redeemable only in the final 30-day renewal window, effectively one annual period at a time.

Economically, one reward is **28.6% of the referred first-year gross price**, which is more generous than ordinary 10–15% first-year customer/affiliate benchmarks. Zoho advertises 15% of first-year revenue for ordinary customer referrals, while Odoo advertises 10% for affiliates. [Zoho referral terms](https://www.zoho.com/r/refer-a-friend.html), [Odoo affiliate program](https://www.odoo.com/affiliate)

The problem is not reward size. It is **trust, timing, and one-sidedness**:

- The friend gets no discount, free month, guided setup, or other explicit referral benefit.
- The share copy says the friend pays and the referrer earns a free year. It is transparent, but can feel self-serving.
- Invalid referral attribution is swallowed during signup and there is no later correction/confirmation UI.
- The reward is deferred until renewal, making it less emotionally immediate.
- The runtime is currently broken.

**Recommendation:** do not launch the referral campaign with the product in its current state. After the product is stable, make the benefit two-sided and reputation-safe. A practical design is 10–15% account credit (or one renewal month) for the referrer plus a meaningful friend benefit such as guided setup, a first-year credit, or a free extension. Release the referrer benefit only after 30–60 days of active paid retention, display attribution and status to both parties, and explicitly disclose the reward. Keep a separate higher-commission, trained tier for CAs/consultants who actually sell and onboard.

Only prompt for a referral after a concrete value milestone: a successful rate update → reopened quality → saved new snapshot → clean quotation cycle, or a documented avoided pricing error. The reward can accelerate advocacy; it cannot compensate for unreliable export, missing data tables, unclear attribution, or weak support.

## Engineering and release-gate results

- `npm test`: **149 files passed; 932 passed, 1 skipped**.
- Focused billing/referral/reuse suite: **6 files and 37 tests passed**.
- `npm run lint`: **0 errors, 1 warning** (`lib/i18n/runtime.ts`, unused `_`).
- `npm run build`: **passed**, including TypeScript and 46 static pages.
- Production deployment: **READY**, commit `2e12978…`, production alias attached.
- Full dependency audit: 17 findings (14 high, 3 moderate).
- Production-only dependency audit: 6 findings (4 high, 2 moderate).
- Supabase advisor: 95 security notices and 435 performance notices. Performance notices are not a launch blocker by count alone, but the security warnings require ownership and documented disposition.

## Release exit criteria

A fresh release run should return GO only when all of the following are true:

1. Production migration head equals the repository migration head.
2. Referral panel loads for a genuinely paid Base owner and BILL-008/BILL-009 runtime scenarios pass.
3. Organization export downloads successfully and its contents are tenant-only, complete, and redacted where required.
4. Server checkout rejects unavailable plan tiers and never defaults to Premium.
5. Production dependency audit has no unaccepted high findings.
6. Base-relevant Supabase advisor warnings are remediated or individually reviewed with tenant/auth negative evidence.
7. Gujarati/Hindi core costing and referral copy is coherent and complete.
8. Direct historical-version editing produces the promised new version.
9. Remaining P0 matrix scenarios—especially payment failure/cancellation, webhook idempotency, concurrency, extreme inputs, password reset, and destructive data controls—are run on isolated fixtures.
10. At least one owner pilot cohort demonstrates repeat use and price acceptance; referral willingness is measured only after successful retained use.

## Evidence files

- `TEST_MATRIX.md` — item-by-item 65-scenario coverage ledger
- `results.json` — machine-readable results and evidence pointers
- `result-updates.json` — current-run ledger updates

This report supersedes the older July/August GO/NO-GO documents for the production behaviors exercised here. It does not convert historical or code-only evidence into a runtime pass.
