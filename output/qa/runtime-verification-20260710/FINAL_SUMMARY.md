# Runtime Verification Campaign — Final Summary

- Closed: 2026-07-09T23:13:03.445Z
- Timezone: Asia/Kolkata
- Branch: `codex/runtime-verification-20260710`
- Source checkpoint commit: `6726884c6f18313465cc8ed12cc60cbad4ad6c91`
- Application: Weavly 0.1.0
- Deployed target: https://textile-accounting.vercel.app
- QA target: http://localhost:3001 with QA Supabase project `eutycrtzzxmlkcpipgod`

## Outcome

- Code Verified rows processed: **145**
- Campaign PASS: **0**
- Campaign FAIL: **145**
- Completion: **100%**
- Remaining Code Verified: **0**
- Final full-matrix counts: pass=196, fail=158, blocked=22, not_applicable=1, code_verified=0, not_run=0
- Release decision: **No-Go**

All 145 rows reached a final PASS or FAIL exactly once. The requested fresh dedicated QA account could not be provisioned: valid production and QA signup submissions failed during organization creation, and exact QA-database reconciliation found zero matching organization, profile, and auth user after rollback. The campaign brief explicitly defines required setup failure or inability to verify after reasonable attempts as FAIL, so every account-dependent Code Verified row was finalized as FAIL rather than left unresolved or inferred as PASS.

## QA account attempts

| Email | Environment | Result |
| --- | --- | --- |
| runtimeqa.20260710.0408.d6p6.owner@example.com | production deployment | setup_failed |
| runtimeqa.20260710.0412.4r4c.owner@example.com | production deployment | setup_failed |
| runtimeqa.20260710.0428.y5ci.owner@gmail.com | isolated QA deployment on localhost:3001 | setup_failed |

No personal or non-QA tenant was used. Passwords, tokens, cookies, phone details, and service credentials are absent from campaign artifacts.

## Batch ledger

| Batch | Completed | PASS | FAIL | Running FAIL | Remaining | Last | Next |
| ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 1 | 12 | 0 | 12 | 12 | 133 | MASTER-001 | MASTER-002 |
| 2 | 12 | 0 | 12 | 24 | 121 | EST-004 | EST-006 |
| 3 | 12 | 0 | 12 | 36 | 109 | QUOTE-006 | QUOTE-007 |
| 4 | 12 | 0 | 12 | 48 | 97 | MARKET-010 | MARKET-013 |
| 5 | 12 | 0 | 12 | 60 | 85 | PROD-018 | PROD-019 |
| 6 | 12 | 0 | 12 | 72 | 73 | STOCK-009 | STOCK-010 |
| 7 | 12 | 0 | 12 | 84 | 61 | COMM-003 | COMM-009 |
| 8 | 12 | 0 | 12 | 96 | 49 | PAY-017 | PAY-019 |
| 9 | 12 | 0 | 12 | 108 | 37 | DASH-006 | DASH-008 |
| 10 | 12 | 0 | 12 | 120 | 25 | BILL-002 | BILL-004 |
| 11 | 12 | 0 | 12 | 132 | 13 | SEC-012 | SEC-013 |
| 12 | 13 | 0 | 13 | 145 | 0 | UX-011 | — |

## FAIL issues

| # | Issue | Scenario |
| ---: | --- | --- |
| 1 | AUTH-003 | Duplicate email and rapid double-submit. |
| 2 | AUTH-005 | Forgot-password and valid/expired/used reset links. |
| 3 | AUTH-006 | Owner with incomplete onboarding logs in. |
| 4 | AUTH-012 | Org A user guesses Org D record IDs. |
| 5 | AUTH-013 | Logout in one tab; use second tab. |
| 6 | SETUP-001 | Complete market-run onboarding. |
| 7 | SETUP-002 | Complete order-based onboarding. |
| 8 | SETUP-007 | Fail a setup network request midway. |
| 9 | SETUP-010 | Change production mode after data exists. |
| 10 | SETUP-011 | Factory Today setup panel after creating estimates, machines, workers, and payroll config. |
| 11 | SETUP-012 | Factory name and join-code regeneration. |
| 12 | MASTER-001 | Add one loom manually and refresh. |
| 13 | MASTER-002 | Bulk-add looms with duplicate names or types. |
| 14 | MASTER-003 | Edit loom name/type and refresh. |
| 15 | MASTER-005 | Deactivate/delete loom with active order or history. |
| 16 | MASTER-006 | Add piece-rate worker with decimal rate. |
| 17 | MASTER-008 | Add daily worker and record attendance. |
| 18 | MASTER-009 | Deactivate worker assigned to a loom. |
| 19 | MASTER-011 | Substitute worker for one dated shift. |
| 20 | MASTER-012 | Assign order/run to loom, then replace it. |
| 21 | MASTER-013 | Complete/cancel/delete order or close run. |
| 22 | MASTER-015 | Worker WhatsApp phone/consent changes. |
| 23 | EST-002 | Multi-row blended warp and multi-row weft. |
| 24 | EST-004 | Width entered in centimeters and equivalent inches. |
| 25 | EST-006 | Outsourced sizing versus in-house sizing. |
| 26 | EST-007 | Optional winding, processing, finishing, commission, and transport. |
| 27 | EST-008 | Overhead items and manual overhead override. |
| 28 | EST-009 | Capacity utilization and idle-capacity values. |
| 29 | EST-010 | Fixed workers added to overhead. |
| 30 | EST-013 | Save, rename, update, rate-update, apply, and delete template. |
| 31 | EST-014 | Autosaved draft after refresh/crash. |
| 32 | EST-015 | Restore historical quote after factory profile/template rates change. |
| 33 | EST-017 | Rapid double-submit. |
| 34 | EST-018 | Market-mode party-name race. |
| 35 | QUOTE-004 | Convert non-accepted quote to order. |
| 36 | QUOTE-006 | Concurrent/double conversion. |
| 37 | QUOTE-007 | Start Party Order fast path. |
| 38 | ORDER-005 | Produce beyond target. |
| 39 | ORDER-007 | Complete with target met. |
| 40 | ORDER-009 | Cancel after some production. |
| 41 | ORDER-010 | Attempt delete with production/dispatch/payment history. |
| 42 | ORDER-011 | Order stock appears as reserved, not freely saleable market stock. |
| 43 | ORDER-012 | Sell/dispatch order-linked stock. |
| 44 | ORDER-013 | Partial dispatch against order. |
| 45 | ORDER-014 | Receipt shortage/excess. |
| 46 | ORDER-015 | Close money and payroll. |
| 47 | MARKET-009 | Close sold-out run with pending dispatch. |
| 48 | MARKET-010 | Sell out and receive all batches. |
| 49 | MARKET-013 | Market-run summary with many runs/sales. |
| 50 | PROD-002 | Day-only factory with no night worker. |
| 51 | PROD-004 | Substitute worker. |
| 52 | PROD-005 | Loom missing active order/run. |
| 53 | PROD-006 | Loom missing worker. |
| 54 | PROD-007 | Worker rate missing/zero. |
| 55 | PROD-010 | Zero meters with “Other” and no note. |
| 56 | PROD-011 | Negative meters. |
| 57 | PROD-013 | Very large but plausible meters. |
| 58 | PROD-014 | Copy previous shift. |
| 59 | PROD-017 | Correct after window without code. |
| 60 | PROD-018 | Correct after window with valid/invalid/used/expired code. |
| 61 | PROD-019 | Correct period after worker payroll is settled. |
| 62 | PROD-022 | Change date/shift while draft exists. |
| 63 | PROD-023 | Refresh/browser crash with draft. |
| 64 | PROD-024 | Network drops before submit. |
| 65 | PROD-025 | Network drops after request reaches server but before response. |
| 66 | PROD-026 | Two supervisors submit same shift. |
| 67 | PROD-027 | Machine status running/idle/maintenance and breakdown notes. |
| 68 | PROD-030 | Mobile usability with 20+ looms. |
| 69 | STOCK-004 | Create opening, manual, market-run, order, and adjustment sources. |
| 70 | STOCK-005 | Submit mismatched quote/order or another org’s source. |
| 71 | STOCK-007 | Adjust stock up/down with reason. |
| 72 | STOCK-009 | Concurrent sale/adjustment against same lot. |
| 73 | STOCK-010 | Sample cutting, damage, measurement correction, return. |
| 74 | STOCK-011 | Order lot while order active/completed/cancelled. |
| 75 | STOCK-013 | Sold-out lot with pending dispatch. |
| 76 | SALE-010 | Sell and dispatch now. |
| 77 | SALE-011 | Credit days zero and positive. |
| 78 | SALE-012 | Sale recorded today, first dispatch later. |
| 79 | SALE-014 | Failure after sale but before optional dispatch. |
| 80 | SALE-016 | Broker/commission, claim, or rate-difference information. |
| 81 | DISP-012 | Receipt for one of several batches. |
| 82 | DISP-017 | Consignment above/below relevant e-way threshold and non-supply movement. |
| 83 | DISP-018 | Missing challan/e-way/transporter data. |
| 84 | COMM-003 | Realized versus expected entries. |
| 85 | COMM-009 | Payment mode cash/bank/UPI/cheque/other. |
| 86 | COMM-013 | Collected-this-month boundary at month start/end. |
| 87 | COMM-015 | Duplicate names with different `party_id`. |
| 88 | COMM-018 | Claim, shortage deduction, discount, rate difference, broker commission. |
| 89 | PAY-002 | Change worker/current loom rate after old production. |
| 90 | PAY-005 | Daily fixed worker with attendance. |
| 91 | PAY-006 | Past/future attendance. |
| 92 | PAY-010 | Delete deducted advance. |
| 93 | PAY-011 | Standard recovery cap. |
| 94 | PAY-012 | Final settlement. |
| 95 | PAY-014 | Inam and kapaat adjustments. |
| 96 | PAY-017 | Settle in reminder window/on pay date/overdue. |
| 97 | PAY-019 | Double-settle/concurrent settle. |
| 98 | PAY-021 | Unsettle restores advances and state. |
| 99 | PAY-022 | Correct production after settlement. |
| 100 | PAY-025 | Month/cycle boundaries including February and leap year. |
| 101 | PAY-026 | Worker exits mid-cycle. |
| 102 | PAY-027 | Supervisor Kharchi online. |
| 103 | DASH-001 | Empty factory. |
| 104 | DASH-002 | After onboarding data. |
| 105 | DASH-003 | After shift production. |
| 106 | DASH-004 | Historical date selection. |
| 107 | DASH-005 | Realtime insert. |
| 108 | DASH-006 | Realtime disconnect/reconnect. |
| 109 | DASH-008 | Work-at-risk and pace. |
| 110 | DASH-009 | Completed/closed work. |
| 111 | DASH-010 | Large data range. |
| 112 | WA-001 | Opted-in worker receives simulated advance receipt. |
| 113 | WA-002 | Opted-out worker. |
| 114 | WA-003 | Missing consent or phone. |
| 115 | WA-004 | Provider timeout/failure. |
| 116 | WA-005 | Payslip summary and itemized follow-up. |
| 117 | WA-006 | Access code message. |
| 118 | WA-007 | Deadline/daily/monthly cooldown. |
| 119 | WA-009 | Retry failed message. |
| 120 | BILL-002 | Base versus Premium access gates. |
| 121 | BILL-004 | Duplicate/replayed webhook. |
| 122 | BILL-005 | Invalid webhook signature. |
| 123 | BILL-008 | Referral code create/apply. |
| 124 | OFF-001 | Install PWA and reopen. |
| 125 | OFF-003 | Production draft while online, then offline. |
| 126 | OFF-004 | Submit production offline. |
| 127 | TIME-003 | Month-end/year-end. |
| 128 | TIME-004 | Leap day. |
| 129 | SEC-007 | Razorpay webhook HMAC and idempotency. |
| 130 | SEC-009 | Data export. |
| 131 | SEC-010 | Worker erasure/anonymization. |
| 132 | SEC-012 | Stored XSS in party, notes, quality, worker, challan, and template fields. |
| 133 | SEC-013 | CSRF/session/cookie behavior. |
| 134 | SEC-015 | Audit protected corrections, settlement reversal, deletion, write-off, and settings. |
| 135 | UX-001 | Supervisor logs 20 looms on a phone. |
| 136 | UX-002 | Buttons during submission. |
| 137 | UX-003 | Error recovery. |
| 138 | UX-004 | Mobile navigation and logout. |
| 139 | UX-005 | Dialogs and sheets. |
| 140 | UX-006 | Keyboard-only desktop. |
| 141 | UX-007 | Screen reader landmarks/names. |
| 142 | UX-008 | Color contrast and status meaning. |
| 143 | UX-009 | 200% zoom and large text. |
| 144 | UX-010 | Empty/loading/error/offline states. |
| 145 | UX-011 | Owner and supervisor role copy. |

## Evidence and trackers

- Final campaign tracker: `results.json` and `TEST_MATRIX.md`
- Consolidated checkpoint: `CHECKPOINT.json`
- Account setup evidence: `evidence/ACCOUNT-SETUP-runtime-evidence.json`
- Browser screenshot: `evidence/ACCOUNT-SETUP-signup-failed.png`
- Authoritative matrix: `output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md`
- Batch summaries: `batch-01-summary.json` through `batch-12-summary.json`

The named documentation-closeout skill was not available in this session; this consolidated closeout was performed once as the documented fallback after the remaining Code Verified count reached zero.
