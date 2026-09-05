# Base Plan user workflows

**Audience:** engineer learning the product through the owner’s day-to-day journey

**Plan:** Weavly Estimator / Base Plan

**Primary actor:** organization owner

## 1. What Base is for

Base is the costing desk for a small or mid-sized weaving business. It helps the owner answer:

1. What does this fabric quality cost under today’s yarn and factory assumptions?
2. What changed since the last costing?
3. Can I preserve the old answer and create a new one safely?
4. Can I share a professional price document without exposing internal economics?
5. Can I recover work or export the organization’s data if access changes?

Base is intentionally not the floor-operating system. It can create a small owner-only production job, metre entry, piece-rate worker record, advance, and basic settlement. It does not create Full Suite production logs, orders, stock, dispatches, formal payroll, or analytics records.

## 2. Base route map

| Route/surface | User-facing label | Purpose |
|---|---|---|
| `/owner/estimator` | Cost Estimate | Create or reopen a live costing. |
| `/owner/rates` | Yarn Rate Book | Review and maintain current yarn/cost rates. |
| `/owner/quotes` | Saved Costings | Search, open, compare, favourite, archive, and restore costing snapshots. |
| `/owner/production` | Production | Create a costing-linked job, record metres by worker, and settle simple piece-rate pay. |
| `/owner/settings` | Settings | Factory identity, estimator defaults, saved qualities, account/security, language, and plan-related controls. |
| `/owner/billing` | Subscription & Billing | Plan status, purchase/renewal, payment state, and referrals. |
| `/owner/data-export` | Privacy & data | Owner-only organization JSON export. Usually reached from Settings. |

On desktop these appear in the owner sidebar. On mobile the Base bottom navigation normally exposes Cost Estimate and a More menu for the other Base surfaces.

## 3. The Base object lifecycle

```text
Factory Cost Profile ─────┐
                          ├─► live EstimateState ─► preview result
Yarn Rate Book ───────────┘                         │
                                                   ▼
                                      Save as Fabric Quality
                                                   │
                                                   ├─► estimator_templates
                                                   └─► Costing v1
                                                        │
                     Rate/default change ──────────────┤
                                                        ▼
                                                  Costing v2/v3…
                                                        │
                                  ┌─────────────────────┼───────────────────┐
                                  ▼                     ▼                   ▼
                              Compare              Internal PDF       Customer PDF
```

Important distinctions:

- **Saved Fabric Quality:** reusable recipe/construction.
- **Saved Costing:** immutable financial answer for a recipe and period’s assumptions.
- **Costing version:** another immutable answer in the same `costing_group_id` lineage.
- **Customer PDF:** export artifact; in Base it is not a Full Suite quotation record.
- **Archive:** hides a record from active lists but does not delete it.

## 4. Workflow matrix

| Workflow | Frequency | Main output | Requires network/server write |
|---|---:|---|---|
| Sign in and entitlement check | Each session | Owner reaches the correct workspace | Yes |
| Configure factory defaults | First setup/monthly review | `factory_cost_profile` | Yes |
| Review/update yarn rate | Weekly or when supplier price changes | `cost_rate_book` + history | Yes |
| Create live cost estimate | Daily/ad hoc | Local calculated result | Not for keystrokes; yes to save |
| Save a quality and first costing | Once per new quality | Template + costing v1 | Yes, transactional |
| Reuse a quality at current rates | Each repeat request | New live result | Yes to save a version |
| Create/compare a new version | On material assumption change | Costing v2/v3… | Yes |
| Export internal/customer document | Per review/customer request | PDF file | PDF is client-side; metadata may save for Full Suite only |
| Draft recovery | On interruption | Restored browser draft | Local browser storage |
| Archive/restore/favourite | As library is maintained | Library metadata | Yes |
| Organization data export | On demand/plan change | Redacted JSON + audit row | Yes |
| Renew/upgrade/downgrade | Billing event | Subscription/payment state | Razorpay + server/webhook |

## 5. Workflow 1 — sign in, subscription, and route boundary

### Trigger

The owner opens the app, signs in, completes onboarding, or returns after a billing event.

### Steps

1. Sign in through Supabase Auth.
2. The application validates the session and reads the authoritative `profiles` row.
3. The owner is associated with an organization through `profiles.org_id`.
4. The server resolves the effective subscription tier from current subscription rows.
5. A Base entitlement opens the estimator workspace. No active entitlement shows the billing/locked state.
6. The owner is sent to the owner home/estimator experience rather than the supervisor floor experience.

### Product result

Base navigation contains Cost Estimate, Yarn Rate Book, Saved Costings, Settings, and Billing. Premium-only routes may be visible only as upgrade walls or omitted from navigation.

### Important boundary

The browser cannot self-upgrade by changing a route, tier field, or `recordKind`. Every protected page and mutation rechecks role/entitlement server-side, and RLS/RPC code repeats the tenant boundary.

## 6. Workflow 2 — configure factory costing defaults

### Trigger

The owner is setting up the business for the first time or a recurring factory expense/output assumption has changed.

### Inputs

- factory/business name and profile;
- warping, sizing, winding, processing, and finishing rates;
- default commission, transport, and margin assumptions;
- enabled optional sections: winding, processing, finishing, commission, transport;
- overhead method: direct ₹/m or monthly expenses divided by output;
- monthly overhead line items such as rent, electricity, repairs, oil, depreciation, security, and admin;
- monthly output metres;
- optional capacity assumptions: loom count, working days, average output per loom/day;
- factory profile/preset and language preferences.

### Steps

1. Open Settings.
2. Open Estimator Defaults / factory cost profile.
3. Select or customize the factory profile.
4. Enter the overhead basis and validate that direct mode has a positive rate or monthly mode has both positive expenses and output.
5. Save. The action uses an expected `updated_at` so an older browser tab cannot silently overwrite a newer profile.
6. Open Cost Estimate and confirm the new defaults are used for a fresh estimate.

### Persistence and invariants

The profile is organization-scoped in `factory_cost_profile`. A profile update affects future calculations; it does not rewrite a saved costing snapshot.

### Current live-QA caveat

In the 9 August 2026 Base QA run, the Settings page showed the two relevant section headings but the dynamic defaults/quality controls did not render. The intended workflow and server actions exist, but a fresh Base onboarding run should verify the deployed rendering path before treating Settings as complete.

## 7. Workflow 3 — maintain the Yarn Rate Book

### Trigger

The owner receives a new supplier rate, wants to confirm an existing rate, or sees a review-due indicator.

### Steps: review a discovered rate

1. Open Yarn Rate Book.
2. Review the rate name, category, current value, source, effective date, previous value, and review status.
3. If the rate was discovered from a saved quality/costing, inspect where it is used.
4. Confirm the current rate when it is still correct. This records a review and next review date without changing the value.

### Steps: change a rate

1. Open the rate entry.
2. Enter the new ₹/kg value, effective date, source, notes, and optional default behavior.
3. Save.
4. The server/database transaction updates the current Rate Book row, previous value/history, and approved synchronized defaults/quality values where applicable.
5. Reopen a saved quality or start a new estimate. Future calculations use the current rate.

### Historical contract

An old costing remains on its original yarn rate. The Rate Book is current state; `cost_rate_history` and `costing_result_snapshot` are historical state.

### Failure states

- stale browser tab: refresh before saving;
- duplicate name/category: choose the existing row or a distinct name;
- archived rate: restore it or create a different active rate;
- invalid value/review period: correct the field before retrying;
- locked organization or missing entitlement: write is refused.

## 8. Workflow 4 — create a new Cost Estimate

### Trigger

A customer asks for a price, the owner wants to test a new quality, or the owner wants to understand the economics of a construction.

### Steps

1. Open Cost Estimate.
2. Start with a blank state or use a saved quality/starting point.
3. Enter the warp recipe: one or more rows, labels, yarn unit/denier or Ne, effective denier, beam ends, yarn rate, GST, and row waste override if needed.
4. Enter the weft recipe: one or more rows, PPI, effective finished width/unit, denier/count, yarn rate, GST, and row waste override if needed.
5. Enter loom/preparation assumptions: loom type, RPM, power, hours/shift, sizing mode, per-pick cost, tape/beam metadata where applicable, warp crimp, and global waste.
6. Select optional preparation/processing/finishing sections.
7. Choose overhead method and enter the direct rate or monthly expenses/output.
8. Enter transport, commission, target margin, and optional quantity. Base can calculate a per-metre decision without a party/order.
9. Review the live cost stack, break-even price, suggested selling price, and warnings.
10. Save as a new quality, save a costing, or leave it as a browser draft.

### What the user sees

The live result should explain not only the final number but the main layers: warp, weft, weaving, warping/sizing, optional processing, overhead, production cost, break-even, selling price, and expected profit when quantity exists.

### Validation examples

- missing/zero required yarn construction values;
- invalid width or suspicious cm/inch input;
- non-positive direct overhead;
- monthly overhead without positive output/expense basis;
- commission plus margin at or above 100%;
- unusual values/capacity warning requiring acknowledgement;
- unreviewed/stale Rate Book defaults.

## 9. Workflow 5 — save a new Fabric Quality and its first costing

### Trigger

The owner has a construction they expect to repeat.

### Steps

1. From the estimator, choose Save as New Quality.
2. Enter a normalized unique quality name.
3. Review the recipe and the calculated snapshot.
4. Confirm the save.
5. The server validates the recipe and authoritative totals, then calls a database transaction that creates the reusable `estimator_templates` row and the initial `estimator_quotes` costing row together.
6. The Saved Costings library shows version 1 for the quality.

### Result

The owner now has:

- an active reusable quality recipe;
- an immutable first costing snapshot;
- a costing lineage/group identity;
- enough data to reopen the quality without reconstructing the form manually.

### Safety behavior

- An archived name remains reserved; silently recreating it is blocked.
- A duplicate click/retry can return the existing result through the request ID instead of creating a duplicate quality/costing.
- The saved quality and initial snapshot are not allowed to drift apart through a half-completed write.

## 10. Workflow 6 — reuse a saved quality at current rates

### Trigger

The same fabric quality is requested again after a yarn supplier or factory assumption changed.

### Steps

1. Open Saved Costings or select the saved quality from the estimator.
2. Load the current reusable recipe.
3. Apply the current Rate Book values for future costing.
4. Restore or explicitly review the latest saved commercial/overhead assumptions.
5. Compare the live result with the prior snapshot before saving.
6. Choose Save New Costing Version when the new answer should become historical record.

### Result

The owner sees current economics without mutating the prior version. The previous version still contains its original yarn rate, overhead basis, margin, and result.

### UX contract

The UI should make this explicit:

```text
Current Rate Book values applied: yes/no
Prior overhead method/output restored: …
Prior commission/transport/quantity restored: …
Quality recipe changed: yes/no
```

The current implementation has a known friction point: live QA found that commercial values could remain non-zero while their sections appeared inactive, causing an unusual-value acknowledgement. Values and section enablement should be made visually consistent.

## 11. Workflow 7 — create a new costing version after a material change

### Trigger

The owner needs a defensible new answer because of yarn-rate movement, output/overhead movement, or a recipe/commercial change.

### Steps

1. Open the latest saved costing for the quality.
2. Change the relevant assumption—for example, weft rate from ₹220/kg to ₹240/kg, or monthly output from 54,000m to 70,000m.
3. Review the warning/change summary.
4. Choose Create New Version.
5. Select:
   - **Save Version Only** to preserve the reusable quality recipe and record only this costing period;
   - **Save Version & Update Quality** to make the changed recipe/current assumptions the new reusable baseline.
6. Confirm the save.

### Result

The next version is placed in the same `costing_group_id` with a monotonic `version_number`. The source version remains immutable.

### When a new version is required

Saving an unchanged repeat should not create noise. A deliberate version is appropriate when the owner needs to preserve a new economic answer or change the reusable quality baseline. Accepted/converted Full Suite records have additional immutability rules; Base costings are already version-oriented.

## 12. Workflow 8 — compare two saved costings

### Trigger

The owner or customer asks why a price changed.

### Steps

1. Open Saved Costings.
2. Select two snapshots from the same or compatible costing lineage.
3. The comparison orders them Old → New using persisted version/date identity.
4. Review the delta as **New minus Old**.

### Comparison areas

- yarn rate and yarn cost by warp/weft layer;
- waste and warp crimp;
- weaving and preparation rates;
- overhead method, monthly expenses, output, and per-metre impact;
- transport, commission, margin, break-even, suggested price;
- expected profit when quantity is present.

### Historical contract

Comparison uses the two persisted canonical snapshots. It does not recalculate either side against today’s factory defaults or today’s Rate Book.

## 13. Workflow 9 — search, sort, favourite, archive, and restore

### Trigger

The costing library has grown or an old quality is no longer active.

### Steps

1. Open Saved Costings.
2. Search/filter by quality, party text where available, margin range, status/context, or date.
3. Sort by recent, oldest, margin, or cost.
4. Favourite a decision record that is frequently referenced.
5. Archive an obsolete costing/quality after confirmation.
6. Open the archive/history view and restore when needed.

### Result

Library state changes only `is_archived`/`is_favorite` metadata on the appropriate row. The costing recipe and financial snapshot do not change.

### Retention expectation

The Base workflow treats archive as reversible retention, not permanent deletion. This matters for auditability, restoration, and organization export.

## 14. Workflow 10 — generate an internal Cost Estimate PDF

### Trigger

The owner wants a readable review document for themselves, a partner, or an internal discussion.

### Steps

1. Open a verified Saved Costing.
2. Choose Internal Cost Estimate in the export dialog.
3. Review the preview.
4. Optionally add internal notes and business name.
5. Download or print the PDF.

### Content boundary

Internal mode can show:

- detailed warp/weft assumptions and row costs;
- waste/crimp and GST inputs;
- weaving/preparation/processing/finishing;
- monthly overhead basis and output;
- production cost;
- break-even, margin, suggested price, and expected profit.

The PDF is generated in the browser through the shared export model and `jspdf`. The app reports that download started; the browser/device is responsible for the actual Downloads location.

## 15. Workflow 11 — generate a customer-safe quotation PDF

### Trigger

The owner needs to send a price to a customer without revealing internal economics.

### Steps

1. Open a verified costing and choose Customer Quotation.
2. Enter customer/party name, quantity, validity date, optional terms, and optional document reference.
3. Review the sandboxed customer preview.
4. Confirm the GST/document note behavior.
5. Download the PDF, print it, or use the device share/WhatsApp handoff.

### Customer privacy boundary

Customer mode may show:

- business name;
- customer name;
- quality label;
- quantity;
- quoted price and quotation value;
- validity date;
- customer terms/notes;
- optional GST note and the “not a GST tax invoice” disclaimer.

It must not show:

- production cost;
- yarn rates/weights used internally;
- overhead items or per-metre overhead;
- break-even;
- commission rate or internal margin;
- expected profit.

### Base-specific boundary

In Base, this is a shareable document artifact created from a standalone costing. PDF sharing does not confirm delivery, and the underlying `record_kind = 'costing'` does not gain Full Suite quotation status. The current live QA build could expose a misleading “Mark as sent” action; it should be hidden or replaced with a Base-safe export/share event until a real status model exists.

## 16. Workflow 12 — recover a browser draft

### Trigger

The browser closes, the owner navigates away, or a costing is interrupted before save.

### Steps

1. The estimator autosaves meaningful state to a user/org-scoped browser key after a short debounce.
2. On a later estimator load, the app detects a draft younger than 24 hours.
3. The owner chooses Restore, Rename, Discard, or Keep for later.
4. Restore repopulates the form and clears the recovery item before a new meaningful edit can be written.
5. Successful server save clears the draft.

### Limitations

- A draft is local to the browser profile and identity scope.
- It is not a server backup or a cross-device draft.
- Clearing browser storage can remove it.
- It does not bypass server validation or create a saved record.

## 17. Workflow 13 — use a saved costing as a starting point

### Trigger

The owner wants to explore a variant without overwriting or extending the original quality lineage.

### Steps

1. Open a saved costing.
2. Choose Use as Starting Point.
3. The estimator loads the recipe and relevant assumptions into a new-quality context.
4. Enter a distinct quality name.
5. Save as a new quality and initial costing.

### Safety contract

This creates a new editable line of work. It does not mutate the source costing group or silently duplicate the old quality name.

## 18. Workflow 14 — export organization data

### Trigger

The owner wants a backup/portability copy, is preparing for a plan change, or is exercising privacy rights.

### Steps

1. Open Settings → Privacy & data or `/owner/data-export`.
2. Start the owner-only export.
3. The server verifies the owner and organization.
4. It reads an explicit tenant-scoped dataset catalog using the admin client, recursively redacts sensitive fields, and creates an export-run record.
5. The export action records an audit event through a service-role-only RPC.
6. The browser downloads a timestamped JSON file and shows the export history.

### Export characteristics

The catalog is broader than Base because it is an organization portability feature; it may include costing, profiles, subscriptions, audit rows, and Full Suite tables if present. Auth credentials, secrets, phone numbers, tokens, tracking data, and other sensitive values are redacted.

## 19. Workflow 15 — billing, renewal, and upgrade boundary

### Base subscription

The current billing catalog calls the plan **Weavly Estimator**. The code’s current annual price constants are:

- first year: ₹7,000 + ₹1,260 GST = ₹8,260 total;
- renewal: ₹2,000 + ₹360 GST = ₹2,360 total.

The billing UI and provider lifecycle are the source of truth for an actual customer transaction; these constants are included here to explain the current code configuration, not to replace billing copy.

### Upgrade to Full Suite

1. The owner opens Billing or an upgrade wall.
2. Razorpay checkout/payment lifecycle is completed.
3. Server-side subscription rows/webhooks establish Premium entitlement.
4. Full Suite routes/actions become available according to production mode.
5. Existing Base costings remain standalone costings; the owner can prepare a new quotation from them in the Full Suite workflow.

### Expiry/cancellation

Subscription access is resolved from paid-through/current-period semantics, not only the latest provider status label. The owner should be able to export organization data even after normal plan access ends according to the product’s post-expiry export contract.

## 20. Workflow 16 — logout and account switch

### Trigger

The owner logs out, changes account, or a session is revoked.

### Expected behavior

1. Active query client is cleared/detached.
2. Organization/user-scoped persisted query cache is removed.
3. Scoped offline mutation data and legacy user cache are cleaned up.
4. Estimator drafts and local production cache keys are not available to the next principal.
5. The next session starts with a fresh verified scope.

This flow is a security requirement, not just a UX reset.

## 21. End-to-end Base happy path

The most representative Base story is a repeat quality whose yarn price changes:

```text
1. Owner configures monthly expenses/output and saves Quality A.
2. Base creates Costing v1 with the current warp/weft rates.
3. Supplier changes the weft yarn rate.
4. Owner updates/reviews the Rate Book.
5. Owner reopens Quality A; current rate is applied to the live estimate.
6. Owner saves Costing v2; v1 remains unchanged.
7. Owner compares v1 → v2 and explains the yarn/production/price delta.
8. Owner optionally changes monthly output and saves Costing v3.
9. Owner downloads an internal cost sheet.
10. Owner enters customer/quantity/validity and downloads a customer-safe quotation PDF.
11. Owner exports organization JSON when needed.
```

## 22. Common failure and recovery states

| State | User-facing recovery | Engineering meaning |
|---|---|---|
| No active entitlement | Go to Billing or export data | Access gate rejected the workspace. |
| Settings data unavailable | Refresh/retry; do not assume defaults saved | Dynamic client loader or network/read failure. |
| Invalid costing input | Correct the highlighted field | Client/server estimator boundary validation. |
| Unusual value warning | Review and explicitly acknowledge | Prevents accidental width, capacity, margin, or commercial assumptions. |
| Duplicate quality name | Use a new name or Use as Starting Point | Name uniqueness is intentional, including archived names. |
| Stale tab | Refresh and compare latest state | Expected timestamp failed optimistic concurrency. |
| Double-click/timeout | Check Saved Costings before retrying | Mutation outcome may be unknown; request ID/idempotent result may already exist. |
| Historical costing needs review | Reopen/reconcile and save a current snapshot | Old row cannot safely be reconstructed/exported as verified economics. |
| Customer PDF validation failure | Add customer, quantity, validity, or fix costing | Customer mode has stricter document prerequisites. |
| PDF download started | Check browser Downloads folder | Browser cannot prove where the device stored the file. |
| Share sheet opened | Attach/send PDF and verify delivery separately | Share handoff is not delivery confirmation. |
| Archive action | Restore from archive when needed | Archive is reversible retention, not deletion. |

## 23. Explicitly out of scope for Base

Do not infer these workflows from the broader repo:

- assigning a loom to a Party Order or Market Run;
- formal day/night shift production logs and supervisor floor entry;
- stock inward, godown reconciliation, sale, or dispatch;
- customer receivables and payment receipts;
- supervisor join/access-code workflows;
- Full Suite worker wages, attendance, Upaad recovery, payslips, and statutory payroll;
- live owner analytics and Factory Today;
- public dispatch tracking;
- full party/supplier ledger or deep yarn/beam inventory.

Those are Full Suite or deferred ERP/governance surfaces. Base’s value is making the economic decision and then providing a deliberately small owner-run follow-through without pretending to be a factory-floor system.

## 24. Base demo acceptance checklist

A good demonstration should prove:

- the owner reaches the Base estimator after sign-in;
- a factory profile/default can be loaded or entered;
- a yarn rate can be reviewed and changed with history;
- a quality can be saved with its first costing;
- a current-rate change creates a new immutable version;
- comparison explains New minus Old;
- internal PDF includes economics;
- customer PDF excludes internal economics;
- a draft can be restored;
- archive/restore is reversible;
- organization JSON export is owner-only and redacted;
- a Premium route is clearly upgrade-walled rather than silently half-enabled.
