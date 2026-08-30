# Weavly Lite S-Tier Closure Sprint

**Date:** 31 August 2026  
**Status:** Proposed  
**Scope:** Weavly Lite only  
**Primary surface:** `/owner/estimator`  
**Supporting surfaces:** `/owner/rates`, `/owner/quotes`, `/owner/settings`, `/owner/billing`, exports, authentication, and shared navigation  
**Audience:** Product, design, engineering, QA, localization, commercial operations, and pilot research

## Executive decision

Lite does not need a smaller textile calculation. It needs the existing calculation to feel unquestionably deliberate, trustworthy, and efficient for a grey-fabric weaving owner.

The owner must continue to provide every input that materially changes yarn consumption, conversion cost, overhead, or selling price. The sprint must not hide required assumptions, silently infer missing values, introduce a second calculation engine, or optimize for a generic SaaS preference for fewer fields.

The S-tier opportunity is instead to:

1. remove all remaining Lite/Base identity leakage;
2. make required inputs, defaults, and current-rate provenance unmistakable;
3. prove that the frequent repeat-quality workflow is fast;
4. make the result, readiness state, and next action continuously understandable;
5. deliver complete English, Hindi, and Gujarati parity;
6. verify accessibility, mobile behavior, performance, recovery, and document privacy;
7. collect real owner evidence rather than certifying S tier from screenshots.

## Starting assessment

| Dimension | Current assessment | Sprint target |
| --- | ---: | ---: |
| Domain appropriateness | 92/100 | Maintain at or above 92 |
| Visual and interaction execution | 88/100 | 92+ |
| Trust, history, and document safety | 91/100 | 95+ |
| Localization and accessibility proof | 78/100 | 90+ with no critical defects |
| Measured production maturity | 80/100 | Evidence-backed release candidate |
| Overall | 87/100 — A | 92+ — S-tier candidate |

The sprint may produce an **S-tier candidate**. Final S-tier certification requires post-release field evidence and successful owner task sessions; it cannot be declared solely because the implementation shipped.

## Persona and domain contract

The primary user is a proprietor or commercial decision-maker of a small or mid-sized weaving unit who understands warp, weft, PPI, denier/count, beam ends, crimp, waste, yarn rate, metres, commission, and margin. The user is not a generic finance user and should not be forced to translate factory language into software language.

The usage model is asymmetric:

- opening and re-costing a saved quality is frequent;
- reviewing a supplier-driven yarn-rate change is frequent or event-driven;
- creating a completely new construction is occasional and appropriately careful;
- comparing versions and exporting documents happens when a price must be explained or shared.

### Inputs that must remain explicit

| Costing dependency | Required product treatment |
| --- | --- |
| Quality identity | Explicit quality name in factory language |
| Warp construction | Denier/count or manual kg, beam ends, crimp, waste, current rate, and applicable GST |
| Weft construction | PPI, effective finished width and unit, denier/count or manual kg, waste, current rate, and applicable GST |
| Conversion | Weaving rate or pick-rate basis, warping, and sizing mode/rate |
| Factory cost | Direct overhead or monthly expenses divided by actual output |
| Commercial decision | Target margin plus intentionally enabled commission, transport, and quantity |

These values may be prefilled from reviewed rates, saved qualities, or factory defaults. They may not be silently guessed or discarded.

## S-tier product principles

1. **Fewer repeated decisions, not fewer costing dependencies.**
2. **One authoritative engine.** Quick and Detailed are presentation states over the same calculation.
3. **Known quality first.** The frequent workflow starts from a saved construction and current reviewed rates.
4. **Visible assumptions.** Any non-zero or included assumption remains discoverable at the point of decision.
5. **No false confidence.** Missing required inputs never become zero; warnings explain the issue and recovery.
6. **Historical truth.** Current rates and defaults affect future work, never an immutable prior costing.
7. **Factory language.** Use familiar textile terms with concise adjacent explanations.
8. **Interruptible by design.** Local draft, server save, stale state, and unknown mutation outcomes are visibly distinct.
9. **Customer privacy by construction.** Customer documents never expose internal economics.
10. **Measured quality.** S tier is supported by task evidence, accessibility results, and field performance.

## Sprint outcome

A domain-literate owner can:

- reopen a known quality and see a valid current price without reconstructing it;
- create a new quality with all required technical inputs and no hidden assumptions;
- understand which values came from the Rate Book, factory defaults, or the current edit;
- identify and resolve every blocking input without scanning the full page;
- explain what changed from the prior costing;
- preserve a new immutable version;
- generate a professional internal or customer-safe document;
- recover interrupted work without confusing a local draft with a factory record;
- complete the same tasks in English, Hindi, or Gujarati;
- use the workflow with keyboard, touch, zoom, reduced motion, and common assistive technology.

---

## Workstream 1 — Lite identity and product-language closure

**Priority:** P0  
**Owner:** Product + frontend + localization

### LST-01 — Remove Lite/Base terminology leakage

- Replace the unconditional `Selling and quantity (optional for Base)` heading with plan-correct, domain-correct language.
- Audit estimator headings, validation, tooltips, dialogs, Saved Costings, Rate Book, Settings, Billing, navigation, exports, filenames, empty states, loading states, and error states for legacy Base/Estimator naming.
- Ensure Weavly Lite is the workspace identity and that “base” remains an internal entitlement term only where unavoidable in code.
- Add a plan-copy regression test that renders the Lite surfaces and fails when user-visible `Base workspace`, `Base plan`, `Estimator Plan`, Full Suite actions, or legacy quotation lifecycle language leaks into Lite.

**Recommended heading:** `Selling price and quantity` with `Optional for a per-metre cost; complete when you want a customer price or total value.`

### LST-02 — Explain Quick and Detailed without implying different accuracy

- Retain one calculation engine.
- Keep Quick as the default only if the interface states that it contains the essential construction inputs and uses the same calculation.
- Describe Detailed as additional inspection and factory assumptions, not a more accurate calculator.
- If owner testing shows that “Quick” implies an approximate answer, test `Essential` versus `Detailed` before renaming it.
- Switching views must preserve every value and never change totals by itself.

### Acceptance criteria

- No Lite user-facing screen refers to the Lite workflow as Base.
- A participant can explain the difference between Quick and Detailed without saying one is an approximate calculation.
- Switching Quick → Detailed → Quick produces identical results when no value changes.
- All required technical inputs remain present in at least one clearly discoverable view.

---

## Workstream 2 — Result comprehension and input provenance

**Priority:** P0  
**Owner:** Product design + frontend + calculation QA

### LST-03 — Keep the decision cockpit continuously understandable

- Preserve production cost, suggested selling price, break-even, actual margin, and expected profit.
- Ensure the first viewport answers:
  - which quality is being costed;
  - whether the result is ready;
  - how many blocking issues remain;
  - what the next useful action is.
- Keep the result reachable while the owner is deep in construction fields without obscuring inputs or mobile navigation.
- When invalid, show dashes rather than plausible zero values.
- The missing-input control must jump to and focus the first blocking field, opening Detailed only when that field genuinely lives there.

### LST-04 — Make value provenance explicit

- Mark values sourced from:
  - current reviewed Rate Book;
  - saved quality recipe;
  - factory default;
  - restored prior commercial assumption;
  - current unsaved edit.
- Do not add a badge to every input. Use quiet section-level provenance plus field-level detail on focus or disclosure.
- When current rates are applied to an old quality, show what changed before saving.
- Any active commission, transport, processing, finishing, or quantity assumption must be visible in the result drivers even if its edit control is collapsed.

### LST-05 — Unify readiness and recovery language

Use a single hierarchy:

1. **Needs input** — calculation cannot be trusted yet.
2. **Review values** — result is visible, but unusual or stale values require deliberate review.
3. **Ready to save** — authoritative result is valid.
4. **Saved locally** — browser draft only.
5. **Saved to factory** — immutable server record exists.
6. **Save outcome unknown** — check Saved Costings before retrying.

Blocking errors, optional suggestions, draft state, and server-save state must not share the same visual treatment.

### Acceptance criteria

- Every invalid state exposes one direct recovery action.
- A user never needs to search the page to find the first required missing field.
- Non-zero hidden assumptions cannot affect the result without appearing in the driver summary.
- Current-rate provenance and historical-snapshot provenance are visually distinct.
- No client/server validation mismatch permits a result to appear ready and then fail for an unexplained field.

---

## Workstream 3 — Frequent repeat-quality workflow proof

**Priority:** P0  
**Owner:** Product + frontend + research

### LST-06 — Make the saved-quality path the proven fast path

- Preserve the searchable saved-quality picker in the estimator.
- Show quality name, latest saved cost, updated date, version count, and rate-review state.
- Provide a clear current-rate action without forcing the owner through the full library.
- Preserve the separate Saved Costings destination for comparison, archive, restore, and detailed history; do not merge the library into the estimator.
- Retain factory defaults and reviewed rates so repeat work does not require re-entry.
- Do not automatically overwrite the saved quality when creating a new costing version.

### LST-07 — Instrument the journey without collecting costing content

Capture privacy-safe events and durations:

- estimator opened;
- blank versus saved-quality start;
- saved quality selected;
- current rate applied/review requested;
- valid result reached;
- save attempted/succeeded/failed/outcome unknown;
- new version created;
- export preview opened/completed/failed;
- draft detected/restored/discarded.

Do not capture quality names, yarn names, rates, prices, notes, customer information, or raw form values in analytics.

### Acceptance criteria

- A repeat quality can reach a current valid result without re-entering its construction.
- A rate change does not mutate the previous costing.
- The owner can explain which current input changed the price.
- Analytics events are tenant-safe, content-free, documented, and covered by privacy review.

---

## Workstream 4 — Localization parity

**Priority:** P0  
**Owner:** Localization + domain reviewer + frontend

### LST-08 — Complete English, Hindi, and Gujarati parity

- Inventory every Lite-visible string, including hardcoded strings in Quick/Detailed views, validation, warnings, dialogs, status text, toasts, exports, billing, and navigation.
- Translate meaning rather than transliterating blindly.
- Preserve familiar textile shorthand such as warp, weft, PPI, denier, crimp, and waste where the target user uses it; add short localized explanations.
- Verify required/optional distinctions and unit labels in all languages.
- Ensure interpolation, pluralization, currency, dates, units, and missing-value states remain correct.
- Verify customer-safe and internal PDF language boundaries independently.

### LST-09 — Add localization regression coverage

- Fail CI on missing Lite translation keys.
- Render the core workflows in all three languages.
- Add screenshot or structural checks for overflow, clipped controls, broken wrapping, and untranslated English fragments.
- Require a domain-literate Gujarati/Hindi reviewer to approve costing terminology.

### Acceptance criteria

- No critical Lite workflow becomes mixed-language.
- No translated label changes the calculation meaning.
- No required field, validation message, save state, or document privacy warning is available only in English.
- Layout remains usable at 320, 360, 390, 430, 768, 1024, and 1440 CSS pixels.

---

## Workstream 5 — Accessibility and input ergonomics

**Priority:** P0  
**Owner:** Frontend + accessibility QA

### LST-10 — WCAG 2.2 AA interaction audit

Verify and remediate:

- visible, high-contrast focus on every input and action;
- no focus indicator removed from custom numeric controls without an equivalent wrapper indicator;
- logical keyboard order through sections, component rows, mode toggles, disclosures, results, and dialogs;
- minimum target sizing and adequate spacing;
- labels, units, instructions, required state, error state, and described-by relationships;
- screen-reader announcements for readiness, calculation changes, save outcomes, and validation;
- focus return after dialogs and sheets;
- no sticky result control or mobile navigation obscures focused content;
- 200% zoom and reflow without two-dimensional scrolling for the primary workflow;
- reduced-motion behavior for swaps, hover elevation, disclosure animation, and skeletons;
- contrast in muted helper text, status badges, warning surfaces, and disabled controls.

### LST-11 — Domain-friendly numeric entry

- Preserve decimal, unit, min/max, and step behavior appropriate to each field.
- Support keyboard entry without unexpected mouse-wheel or arrow-key mutations.
- Retain entered text during recoverable validation errors.
- Keep cm/inch and formula/manual-kg switches explicit and lossless.
- Confirm that locale formatting does not corrupt the authoritative numeric payload.

### Acceptance criteria

- Automated accessibility scans report no critical or serious violations on the defined routes and dialogs.
- All core tasks are completable without a pointer.
- A screen-reader user can identify field purpose, unit, requirement, error, and result state.
- No focused element is hidden behind a sticky or fixed surface.

---

## Workstream 6 — Performance and resilience evidence

**Priority:** P0  
**Owner:** Frontend platform + observability + QA

### LST-12 — Establish authenticated route performance budgets

Instrument privacy-safe Web Vitals by route, device class, language, and Lite entitlement:

- LCP target: 2.5 seconds or less at the 75th percentile;
- INP target: 200 milliseconds or less at the 75th percentile;
- CLS target: 0.1 or less at the 75th percentile.

Do not claim a field pass before sufficient production samples exist. During the sprint, enforce lab budgets for login → estimator, saved-quality open, mode switch, result expansion, Saved Costings open, Rate Book open, and export-preview open.

### LST-13 — Reduce work only where measurement identifies delay

- Profile the estimator before changing bundle boundaries or memoization.
- Lazy-load PDF/export code and low-frequency dialogs when this reduces initial interaction cost without introducing visible delay at export time.
- Avoid broad rewrites of the calculation state model without a measured bottleneck.
- Keep route skeletons structurally stable to prevent layout shift.
- Verify large saved-quality and Rate Book datasets, not only empty/small fixtures.

### LST-14 — Prove interruption and failure recovery

Test:

- slow and dropped network during load;
- offline editing and return to network;
- browser close and draft restore;
- stale tab against newer factory defaults;
- server save timeout with an unknown outcome;
- double-click/retry idempotency;
- expired entitlement with export access;
- logout/account switch with local-data isolation;
- PDF generation/download failure.

### Acceptance criteria

- No critical journey loses entered work after a recoverable failure.
- Unknown mutation outcomes tell the owner how to verify before retrying.
- Route transitions show stable, content-shaped feedback rather than blank pages.
- Lab budgets pass before release; field S-tier certification remains pending until the 75th-percentile sample window passes.

---

## Workstream 7 — Document and commercial trust

**Priority:** P1 for UX; external prerequisite for commercial certification  
**Owner:** Product + legal/tax + billing engineering

### LST-15 — Reverify the document privacy boundary

- Internal Cost Sheet may show construction, rates, cost stack, overhead, break-even, margin, and expected profit.
- Customer-safe Quotation may show business/customer context, quality, quantity, price, validity, and approved terms.
- Customer output must never contain internal yarn economics, overhead, break-even, commission, margin, or expected profit.
- Preview and final PDF must use the same view model.
- Filenames and document titles must identify Lite correctly.

### LST-16 — Resolve GST invoice readiness honestly

- Confirm incorporation, GST registration, invoice-numbering, place-of-supply, tax breakup, supplier identity, and accounting prerequisites with the responsible business owner.
- If legally ready, implement and verify a genuine GST tax invoice as a separate billing document.
- If not legally ready, retain the accurate payment-receipt policy. Do not generate a document that merely looks like a tax invoice.
- Record commercial S-tier certification as blocked until the legal prerequisite is resolved; do not hide the limitation with softer copy.

### Acceptance criteria

- Automated privacy fixtures prove forbidden internal fields are absent from customer output.
- Receipt and GST invoice are never represented as interchangeable.
- Commercial certification states the real legal capability.

---

## Workstream 8 — Owner validation and S-tier certification

**Priority:** P0  
**Owner:** Product research + founder + QA

### LST-17 — Run domain-owner task sessions

Recruit at least five representative grey-fabric weaving owners or trusted costing decision-makers. Do not substitute internal engineers for all sessions.

Each participant completes:

1. open a saved quality and state today’s credible price;
2. apply a supplier yarn-rate change and create a new version;
3. explain why the price changed;
4. create one new quality from construction inputs;
5. identify an intentionally missing or unusual value;
6. create an internal Cost Sheet;
7. create a customer-safe Quotation and identify what remains private;
8. recover an interrupted draft;
9. find and restore an archived costing.

Run at least one Gujarati-preferred and one Hindi-preferred session when representative users are available.

### LST-18 — Measure outcomes, not field count

Record:

- task completion without facilitator intervention;
- time to valid current result for a saved quality;
- time to save a deliberate new version;
- time to valid result for a new quality;
- number and location of wrong-field entries;
- ability to explain current versus historical rates;
- ability to distinguish local draft from factory save;
- ability to identify customer-safe versus internal output;
- confidence rating and verbatim hesitation points.

Provisional certification thresholds:

- at least 90% completion of critical tasks without facilitator rescue;
- zero historical-snapshot corruption or customer-document privacy failures;
- all participants can identify the current price and why it changed;
- all participants can distinguish local draft from saved factory record;
- median saved-quality result time is materially faster than rebuilding the construction and meets the baseline target established before implementation;
- no repeated hesitation attributable to Lite/Base identity, Quick/Detailed accuracy, or hidden active assumptions.

Time thresholds must be compared with the measured pre-sprint baseline. Do not invent a “fast” number without observing the persona.

### LST-19 — Maintain an evidence ledger

For every acceptance criterion record:

- build/commit/deployment identity;
- tenant and run prefix;
- device/browser/language;
- task steps and expected result;
- sanitized screenshots or structural snapshots;
- console/network failures;
- database evidence where persistence matters;
- participant outcome and issue severity;
- pass, fail, or blocked status.

---

## Delivery sequence

### Wave 0 — Baseline and freeze

- Capture current repeat-quality and new-quality task baselines.
- Inventory Lite strings, analytics, accessibility failures, Web Vitals availability, and document policy.
- Freeze calculation formulas and snapshot schemas unless a validated defect is found.

### Wave 1 — Coherence and comprehension

- Deliver LST-01 through LST-07.
- Release behind a Lite-scoped feature flag if the change materially alters estimator interaction.
- Verify no calculation, snapshot, Rate Book, or export regression.

### Wave 2 — Quality parity

- Deliver LST-08 through LST-16.
- Complete three-language, accessibility, responsive, resilience, and document QA.
- Establish performance instrumentation and lab budgets.

### Wave 3 — Owner validation and controlled release

- Run LST-17 through LST-19 on the release candidate.
- Fix P0/P1 findings and rerun affected tasks.
- Roll out gradually to Lite QA/pilot tenants, then all eligible Lite tenants.
- Begin the field-performance observation window.

## Severity model

| Severity | Definition | Release treatment |
| --- | --- | --- |
| P0 | Wrong calculation, historical mutation, tenant leak, customer privacy leak, data loss, inaccessible critical task, or false billing/tax document | Blocks release |
| P1 | User cannot complete a core task without assistance, plan identity is wrong, recovery is unclear, translation changes meaning, or serious mobile/accessibility failure | Blocks S-tier certification |
| P2 | Noticeable friction, unclear secondary action, avoidable repetition, minor translation/layout problem | Fix in sprint when repeated; otherwise evidence-backed follow-up |
| P3 | Cosmetic preference without task or trust impact | Does not block release |

## Cross-route QA matrix

| Surface | Core checks |
| --- | --- |
| Login/access | Correct Lite destination, expiry/renewal boundary, no Full Suite leakage |
| Cost Estimate | Blank quality, saved quality, Quick/Detailed parity, validation, warnings, readiness, save, unknown outcome |
| Yarn Rate Book | Review due, rate change, history, usage provenance, archive/restore |
| Saved Costings | Search, filters, open, starting point, version comparison, favourite, archive/restore |
| Settings | Defaults, optimistic concurrency, optional assumptions, business identity, data controls |
| Billing | Workspace/subscription distinction, manual renewal, receipt, GST policy, failed attempt history |
| Exports | Internal/customer privacy, preview/final parity, language, filename, failure recovery |
| Draft recovery | Restore, rename, discard, keep, identity isolation, expiration |

Test on current stable Chrome, Edge, Safari, and Firefox where supported; representative Android and iOS devices; keyboard-only; screen reader; 200% zoom; reduced motion; slow network; offline/reconnect; and all three languages.

## Regression and release gates

1. Server-authoritative calculation fixtures remain unchanged unless tied to an approved calculation defect.
2. Quick/Detailed parity tests pass.
3. Every saved costing remains immutable under Rate Book and Settings changes.
4. Customer document privacy tests pass with zero forbidden-field leakage.
5. Lite plan-copy tests pass with no Base/Full Suite leakage.
6. English, Hindi, and Gujarati critical-path tests pass.
7. Automated accessibility scans have no critical or serious findings; manual keyboard and screen-reader tasks pass.
8. Responsive checks pass at defined widths with no clipped critical action.
9. Focused tests, full tests, TypeScript, lint, and production build pass.
10. Authenticated production smoke QA shows no console errors or warnings attributable to the release.
11. P0 and P1 owner-session findings are closed and retested.
12. Rollback instructions and pre-release database compatibility are documented.

## Explicit non-goals

- Removing required warp, weft, conversion, overhead, or commercial inputs.
- Hiding active assumptions to make the screen look shorter.
- Creating a second approximate or client-only calculation engine.
- Adding CRM, customer master, receivables, stock, dispatch, formal production, supervisor access, or advanced payroll.
- Adding dashboards, vanity activity metrics, AI-generated costing assumptions, or spreadsheet import without user evidence.
- Recalculating historical snapshots against current rates or defaults.
- Issuing a fake GST tax invoice before legal and accounting prerequisites exist.
- Declaring S tier from internal screenshots alone.

## Definition of done

The sprint is complete when:

- the complete required textile calculation remains intact;
- Lite identity is coherent everywhere;
- repeat-quality and new-quality journeys pass owner validation;
- current, default, saved, and edited assumptions are understandable;
- readiness, warnings, drafts, server saves, and unknown outcomes are distinct;
- all critical workflows have English, Hindi, and Gujarati parity;
- accessibility, responsive, resilience, privacy, and lab-performance gates pass;
- production field metrics are collecting safely;
- no P0 or P1 finding remains open;
- the release is labeled **S-tier candidate** until field performance and sustained owner evidence complete the certification window.

