# Weavly Base P1 Remediation Sprint

**Sprint objective:** Close every P1 blocker in the 30 July Base Pilot Go/No-Go report without enabling Full Suite production workflows.

**Source report:** `output/pdf/WEAVLY_BASE_PRODUCT_PILOT_GO_NO_GO_REPORT_2026-07-30.pdf`

**Scope:** Weavly Base / Estimator plan only.

**Sprint start:** P0 remediation is deployed; three report-defined P1 findings remain.

**Sprint length:** 4 working days plus a deployed Base-only workflow retest.

## Exit rule

The sprint is complete only when all three P1 workflows meet their data and artifact gates:

1. Saving a quality either creates the quality and its initial costing snapshot or leaves neither record behind.
2. Start From creates a new template identity and a new costing group; source edits and versions remain untouched.
3. Base captures a customer and positive quantity inline, persists them in the costing snapshot, and exports them in both documents.

Local tests are necessary but not sufficient. The final gate requires deployed UI and tenant-scoped persistence proof.

## Sprint board

| ID | Workstream | Owner role | Estimate | Status |
| --- | --- | --- | ---: | --- |
| P1-QUALITY | Quality-save validation and rollback integrity | Product engineer | 0.75 day | Implemented locally |
| P1-COPY | Independent Start From identity | Product engineer | 0.5 day | Implemented locally |
| P1-CONTEXT | Base customer and quantity workflow | Product engineer + product QA | 1.0 day | Implemented locally |
| P1-ARTIFACT | Saved Costings and PDF context reconciliation | Product engineer + QA | 0.5 day | Implemented locally |
| P1-RETEST | Deployed Base workflow and database proof | QA/release owner | 1.25 days | Pending deployment |

## Day 1 - Quality-save integrity

- Treat a saved quality as a reusable recipe, not a production beam plan.
- Do not require hidden tape length for a Base quality or Base costing snapshot.
- Validate the complete initial snapshot before inserting the template.
- If the snapshot write fails unexpectedly, delete the exact tenant-scoped template and verify the deletion returned the inserted identity.
- Keep the save request idempotent through the deterministic initial-snapshot request ID.

**Acceptance:** A valid Base recipe with `tape_length_m = 0` saves successfully. Invalid recipe or snapshot input writes zero templates and zero quotes. A downstream snapshot failure cannot leave an active template.

## Day 2 - Independent duplication

- Preserve the copied yarn, construction, costing, and commercial assumptions in memory.
- Before opening Start From, detach:
  - the applied template ID;
  - the source quote ID and timestamp;
  - the source record kind;
  - the previous idempotency request ID.
- Save the chosen copy name through the new-quality path.
- Verify the copy receives its own template ID, costing group ID, and version 1 snapshot.

**Acceptance:** Updating or deleting the copy does not alter the source. A later copy costing increments only the copy's version chain.

## Day 3 - Base commercial context

- Make party/customer context available to Base without enabling order conversion.
- Load up to 25 recent distinct customer names from tenant-scoped estimator history.
- Allow selection of a recent customer or free-text creation of a new name.
- Show costing quantity in Base with a 5,000m pilot-friendly placeholder.
- Require explicit customer, quality, and positive quantity before saving a Base costing.
- Persist the same customer in `party_name` and quantity in both `order_quantity_m` and the legacy `meters` field.
- Include customer and quantity in the automatic first snapshot when a new quality is saved from a populated costing.

**Acceptance:** A Base owner can enter or select a customer, enter 5,000m, save, reopen, and see the exact values.

## Day 4 - Artifact reconciliation and release gate

- Prefill customer name when exporting a Base saved costing.
- Show quantity, quotation value, and customer in the customer PDF.
- Show quantity, target/actual margin, and total expected profit in the internal PDF.
- Show customer context and quantity in Saved Costings history.
- Run focused tests, full Vitest, lint, optimized production build, and production dependency audit.
- Deploy the exact tested revision and rerun QUALITY-001, QUALITY-002, EST-007, PARTY-001, QUOTE-001, and QUOTE-002.

## Acceptance ledger

| Gate | Required proof | Blocker condition |
| --- | --- | --- |
| QUALITY-01 | Base save accepts a valid recipe without tape length | Hidden tape validation rejects the save |
| QUALITY-02 | Snapshot boundary validation runs before template insert | Invalid snapshot leaves a template |
| QUALITY-03 | Failed snapshot removes and returns the exact inserted template | Partial active template survives |
| COPY-01 | Start From clears every source identity before save | Copy retains source template or quote identity |
| COPY-02 | Source and copy have different template and costing-group IDs | Copy becomes the next source version |
| PARTY-01 | Base shows recent-party chooser plus free-text customer input | Customer exists only in export dialog |
| PARTY-02 | Base save requires and persists explicit customer | Quality label is silently used as customer |
| QTY-01 | Base shows and requires positive costing quantity | Saved row remains 0m |
| QTY-02 | Reopen restores the exact saved quantity | Quantity is lost or recomputed |
| PDF-01 | Customer PDF shows customer, quantity, unit price, and total | Context or total is missing |
| PDF-02 | Internal PDF shows quantity, margin, and expected total profit | Profit is shown only per metre with quantity present |
| BOUNDARY-01 | Base still cannot create orders, market runs, or production | P1 change leaks Full Suite capability |

## Implementation map

| Area | Files |
| --- | --- |
| Base commercial capability | `lib/costing-workspace.ts` |
| Quality validation, rollback, parties, persistence | `app/(dashboard)/owner/estimator/actions.ts` |
| Initial party data | `app/(dashboard)/owner/estimator/page.tsx` |
| Party, quantity, duplicate, export UI | `app/(dashboard)/owner/estimator/EstimatorClient.tsx` |
| Saved Costings context/export | `app/(dashboard)/owner/quotes/QuotesClient.tsx` |
| Regression coverage | `__tests__/base-p1-remediation.test.ts`, `__tests__/costing-workspace-foundation.test.ts`, `__tests__/estimator-production-readiness.test.ts` |

## Risks and controls

- **Product boundary:** Base stores commercial context but `getNewEstimateRecordKind(false)` still forces `costing`; quotation lifecycle and production conversion remain false.
- **Legacy rows:** Older Base snapshots with party equal to quality or quantity 0 remain historical evidence. New saves and versions carry explicit context.
- **Rollback window:** Complete boundary validation occurs before the first write. The existing two-write workflow retains exact compensating cleanup for unexpected database failures and now verifies that cleanup returned the created row.
- **Duplicate history:** Existing bad copies are not rewritten automatically. The deployed retest must create a fresh copy and verify independent IDs.
- **Dirty worktree:** Only the two retained quality-save edits were incorporated because they directly close QUALITY-01; unrelated QA artifacts remain untouched.

## Local verification evidence

- Focused P1 regression: 5 files and 42 tests passed.
- Full Vitest suite: 116 files passed; 783 tests passed and 1 intentionally skipped.
- Lint: full repository lint passed.
- Production build: Next.js 16.2.12 optimized Webpack/PWA build passed, including TypeScript and 45 static pages.
- Production dependency audit: `npm audit --omit=dev` found 0 vulnerabilities.

## Definition of done

- Focused and full local release gates pass.
- The exact tested revision is deployed.
- A fresh `BASEP1` workflow saves a quality with hidden tape length absent and produces one template plus one initial snapshot.
- Start From produces a second template and a distinct costing group at version 1.
- A 5,000m customer costing reopens with exact customer and quantity.
- Internal and customer PDFs agree with UI and database values.
- No Full Suite production capability is exposed to the Base account.
