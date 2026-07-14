# GOLDEN-A-03 — Independent Textile Estimate Truth Sheet

Prepared: 2026-07-14 IST

Current status: `BLOCKED` (`pilot_core`, gating)

Truth-sheet author: **owner/factory estimator who calculates the reference independently of Weavly**

Independent reviewer: ____________________

## Canonical requirement

> Build a real fabric estimate and compare it with the truth sheet.

Expected: complete the step and preserve all stated downstream invariants.

Estimator source/tests prove calculation behavior, including formula/manual yarn modes and quote snapshots, but `output/qa/blocked-row-campaign/B19-external-evidence-review.json` found no completed, business-accepted independent real-fabric reference. Repository tests are not a substitute for this sheet.

## Independence rule

Complete and freeze sections 1–6 **before** entering the estimate into Weavly. The author must use the factory's existing register, spreadsheet, calculator, or documented method without copying Weavly outputs. Record the source file/photo IDs and a SHA-256 checksum or signed page count. Do not revise the truth sheet to make a variance disappear; corrections require a dated correction record explaining the original error and reviewer approval.

Truth sheet frozen at/date/time/time zone: ____________________

Independent source artifact(s): ____________________

Frozen artifact checksum/page count: ____________________

## 1. Identity and commercial context

| Field | Independent value |
| --- | --- |
| Fabric/quality name and internal reference |  |
| Real customer/party or approved anonymized reference |  |
| Estimate purpose (party order / market run) |  |
| Estimate date and market-rate effective date |  |
| Order quantity (m) |  |
| Finished width and unit |  |
| Effective costing/loom width and unit |  |
| Loom type |  |
| Calculation method/source |  |
| Author name/role |  |

## 2. Yarn inputs

Choose `formula` or `manual kg/100m` independently for each row. For English cotton count, record Ne and convert to effective denier as `5315 ÷ Ne`. A manual row's kg/100m must come from the external method; Weavly's formula value is informational only.

### Warp layers

| Layer/name | Mode | Denier or Ne | Effective denier | Beam ends | Manual base kg/100m | Yarn ₹/kg | GST % | Row waste % or global | Warp crimp % |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 |  |  |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |  |  |

### Weft layers

| Layer/name | Mode | PPI | Finished width | Effective costing width | Denier or Ne | Effective denier | Manual base kg/100m | Yarn ₹/kg | GST % | Row waste % or global |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 |  |  |  |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |  |  |  |

Global yarn waste/shortage %: ______

Width conversion used: `inches = cm ÷ 2.54` / other: ______

Note: current Weavly formula mode uses **effective costing width** for weft consumption. Record finished width separately so a unit/allowance mistake is visible.

## 3. Conversion and factory-cost inputs

| Input | Independent value | Unit / enabled? |
| --- | ---: | --- |
| Loom/weave charge |  | ₹/m or ₹/pick/paise-per-pick; show conversion |
| Warping rate |  | ₹/kg |
| Sizing mode |  | in-house / outsourced |
| Sizing rate |  | ₹/kg if outsourced |
| Winding rate |  | ₹/kg / disabled |
| Processing |  | ₹/m / disabled |
| Finishing |  | ₹/m / disabled |
| Monthly output |  | m/month |
| Loom count |  | count |
| Average output/loom/day |  | m |
| Working days/month |  | days |
| Overhead override |  | ₹/m / none |
| Transport |  | ₹/m / disabled |
| Commission |  | % of selling price / disabled |
| Desired profit margin |  | % of selling price |

### Monthly overhead items

| Item | Monthly amount ₹ | Source/derivation |
| --- | ---: | --- |
| Rent/lease |  |  |
| Electricity |  |  |
| Water/maintenance |  |  |
| Consumables |  |  |
| Fixed staff and other items |  |  |
| **Total monthly overhead** |  |  |

## 4. Formulas to show on the independent sheet

Use the factory method, but show each step and clearly identify any method that differs from Weavly. Current Weavly formulas are:

```text
effective_denier = denier, or 5315 / Ne
warp_base_kg_per_100m = beam_ends * effective_denier / 90000
weft_base_kg_per_100m = PPI * effective_costing_width_inches * effective_denier / 90000
warp_final_kg_per_100m = warp_base * (1 + (warp_crimp_pct + row_or_global_waste_pct) / 100)
weft_final_kg_per_100m = weft_base * (1 + row_or_global_waste_pct / 100)
yarn_cost_per_m = base_kg_per_100m * yarn_rate * (1 + GST/100) * (1 + adjustment_pct/100) / 100
weave_cost_per_m = sum(PPI) * rupees_per_pick
warping_sizing_per_m = total_warp_final_kg_per_100m * (warping_rate + effective_sizing_rate) / 100
winding_per_m = total_final_yarn_kg_per_100m * winding_rate / 100
direct_cost_per_m = warp + weft + weave + warping/sizing + winding + processing + finishing
overhead_per_m = total_monthly_overhead / monthly_output, unless an explicit positive override is used
production_cost_per_m = direct_cost_per_m + overhead_per_m
quote_per_m = (production_cost_per_m + transport_per_m) / (1 - commission_pct/100 - margin_pct/100)
commission_per_m = quote_per_m * commission_pct/100
landed_cost_per_m = production_cost_per_m + transport_per_m + commission_per_m
order_value = quote_per_m * order_quantity_m
gross_profit = (quote_per_m - landed_cost_per_m) * order_quantity_m
actual_margin_pct = gross_profit / order_value * 100
```

Warp crimp and waste are additive percentages in current Weavly; warp crimp does not apply to weft. A row-level waste value overrides the global value; an explicit zero means zero. Commission and margin must sum to less than 100%.

## 5. Independent intermediate values

### Yarn calculation

| Layer | Base kg/100m | Crimp % | Waste % | Final kg/100m | Rate incl. GST ₹/kg | Cost ₹/100m | Cost ₹/m |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Warp 1 |  |  |  |  |  |  |  |
| Warp 2 |  |  |  |  |  |  |  |
| Weft 1 |  | 0 |  |  |  |  |  |
| Weft 2 |  | 0 |  |  |  |  |  |
| **Totals** |  |  |  |  |  |  |  |

### Cost stack

| Layer | Independent ₹/m | Derivation/source |
| --- | ---: | --- |
| Warp yarn |  |  |
| Weft yarn |  |  |
| Yarn adjustment portion |  |  |
| Weave/loom |  |  |
| Warping + sizing |  |  |
| Winding |  |  |
| Processing |  |  |
| Finishing |  |  |
| **Direct cost** |  |  |
| Overhead |  |  |
| **Production cost** |  |  |
| Transport |  |  |
| Commission |  |  |
| **Landed cost** |  |  |
| **Quote price** |  |  |
| Order value |  |  |
| Gross profit |  |  |
| Actual margin % |  |  |

## 6. Rounding and variance policy

All intermediate calculations should retain at least six decimal places. Apply round-half-up only at the stated comparison/display boundary. Default pilot tolerances mirror the existing estimator regression boundaries; the business reviewer must approve them before comparison.

| Comparison | Default maximum absolute variance | Approved alternative |
| --- | ---: | ---: |
| Input after explicit unit conversion | Exact |  |
| Yarn base/final kg per 100m | 0.001 kg/100m |  |
| Individual yarn/cost layer | ₹0.05/m |  |
| Production cost, landed cost, quote price | ₹0.10/m |  |
| Percentage | 0.10 percentage point |  |
| Order total/gross profit | Larger of ₹1.00 or per-m tolerance × quantity |  |

Do not net positive and negative layer variances. Each layer must pass independently. Any variance outside tolerance requires a written cause, owner decision, and rerun; an “accepted” unexplained variance does not close the gate.

Business reviewer approval of policy/date: ____________________

## 7. Weavly comparison

Deployed URL/build/commit: ____________________

Account role and estimate/quote ID: ____________________

Entry/capture date/time/time zone: ____________________

| Measure | Independent | Weavly | Absolute variance | Tolerance | Pass? | Explanation / source |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Warp 1 base kg/100m |  |  |  | 0.001 |  |  |
| Warp 1 final kg/100m |  |  |  | 0.001 |  |  |
| Additional warp rows |  |  |  | 0.001 |  |  |
| Weft 1 base kg/100m |  |  |  | 0.001 |  |  |
| Weft 1 final kg/100m |  |  |  | 0.001 |  |  |
| Additional weft rows |  |  |  | 0.001 |  |  |
| Warp yarn ₹/m |  |  |  | 0.05 |  |  |
| Weft yarn ₹/m |  |  |  | 0.05 |  |  |
| Weave ₹/m |  |  |  | 0.05 |  |  |
| Warping/sizing ₹/m |  |  |  | 0.05 |  |  |
| Winding/processing/finishing each |  |  |  | 0.05 |  |  |
| Direct cost ₹/m |  |  |  | 0.10 |  |  |
| Overhead ₹/m |  |  |  | 0.05 |  |  |
| Production cost ₹/m |  |  |  | 0.10 |  |  |
| Landed cost ₹/m |  |  |  | 0.10 |  |  |
| Quote ₹/m |  |  |  | 0.10 |  |  |
| Order value ₹ |  |  |  | policy |  |  |
| Gross profit ₹ / margin % |  |  |  | policy |  |  |

### Variance register

| ID | Measure | Root cause (input, unit, method, rounding, defect) | Truth-sheet correction? | Product change? | Owner | Rerun evidence | Reviewer disposition/date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GA03-VAR-01 |  |  |  |  |  |  |  |

## 8. Downstream snapshot checks

Only perform actions authorized for this real estimate. If the owner does not authorize creating/accepting/converting a real quote yet, keep the row `BLOCKED` and complete this section later.

| Invariant | Expected independent/accepted value | Saved quote | Restored quote | Accepted order/downstream snapshot | Pass/evidence |
| --- | ---: | ---: | ---: | ---: | --- |
| Production cost ₹/m |  |  |  |  |  |
| Landed cost ₹/m |  |  |  |  |  |
| Quote price ₹/m |  |  |  |  |  |
| Intended margin % |  |  |  |  |  |
| Worker/loom rate snapshot ₹/m |  |  |  |  |  |
| Warp required kg for order |  |  |  |  |  |
| Weft required kg for order |  |  |  |  |  |
| Party, quality, target metres |  |  |  |  |  |
| Source quote/order linkage | n/a |  |  |  |  |

Record quote ID, order ID if applicable, screenshots/audit export IDs, and confirmation that no value was manually altered downstream to force a match.

## Reviewer decision and dated approval

- [ ] **PASS RECOMMENDED** — the truth sheet was prepared independently, every input/method is identified, all layers are within approved tolerance, all variances are explained and rerun, and downstream snapshots match.
- [ ] **CHANGE / INVESTIGATE** — approval withheld; variance IDs: ____________________.
- [ ] **REJECTED** — the estimate or method is not business-acceptable.

Truth-sheet author name/role/signature/date: ____________________

Independent reviewer name/role/signature/date: ____________________

Weavly operator name/date: ____________________

Owner final approval/date/time zone: ____________________

## Required closure artifacts and acceptance criteria

- [ ] Frozen independent source prepared before Weavly entry, with checksum/page count.
- [ ] Complete inputs, units, formulas/method, intermediate values, and approved tolerances.
- [ ] Weavly audit/cost-stack capture from the approved deployed build.
- [ ] Line-by-line comparison with no unexplained or offsetting variance.
- [ ] Dated variance correction/rerun evidence where needed.
- [ ] Saved/restored and authorized downstream snapshot comparison.
- [ ] Named author, independent reviewer, operator, and owner approval.

`GOLDEN-A-03` may become `PASS` only when every checkbox is complete. Tests, a sample fixture, an unsigned spreadsheet, or a truth sheet rewritten after seeing Weavly is insufficient.

## Exact matrix-update procedure after real closure

1. Store the frozen truth sheet, checksum manifest, Weavly comparison, variance/rerun records, downstream proof, and signed approval under `output/qa/pilot-gate-closure/YYYY-MM-DD/GOLDEN-A-03/`.
2. Edit only `GOLDEN-A-03` in `results.json`: set `status` to `pass`; replace `actual` with fabric reference, author/reviewer/date, tolerances, comparison result, variance disposition, and downstream snapshot result; point `evidence` to the new artifacts; replace `notes` with the accepted independent reconciliation; set the real `updatedAt`; preserve `pilot_core` and `pilot_gating: true`.
3. Update only the matching `TEST_MATRIX.md` row, recalculate ledger counts, and verify paths/checksums.
4. Reconcile the standard closeout docs to the real artifact and counts without promoting another row.
5. Run focused estimator tests, `git diff --check`, and a second-person evidence/matrix review before commit.

## Exact human and laptop actions still required

1. **Factory estimator:** choose one real fabric and complete/freeze sections 1–6 independently, before opening Weavly.
2. **Business reviewer:** approve the method and tolerance table; sign/date the frozen source.
3. **Owner laptop:** enter the exact inputs in `/owner/estimator` on the approved deployed build and export/capture the audit values without changing the truth sheet.
4. **Reviewer + operator:** complete every comparison and variance row; correct the true source of any variance and rerun.
5. **Owner laptop:** save/restore the quote and, only if authorized, accept/convert it; capture the downstream invariant table.
6. **Independent reviewer and owner:** provide dated final approval.
7. **Documentation operator:** perform the exact matrix update. Keep `GOLDEN-A-03` `BLOCKED` until step 6 succeeds.
