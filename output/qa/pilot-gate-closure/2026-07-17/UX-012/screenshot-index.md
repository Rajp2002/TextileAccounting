# UX-012 screenshot index

Date: 2026-07-17 IST

Environment: local Next.js development server connected to the confirmed QA
Supabase project `eutycrtzzxmlkcpipgod`.

| File | Auth context | Evidence |
| --- | --- | --- |
| `01-public-terminology.png` | Public | Cost Estimate, Quotation history, Machine assignments |
| `02-public-workflow-terminology.png` | Public | Public workflow terminology |
| `03-owner-navigation-terminology.png` | Premium owner | Owner navigation, Factory Today, Machines, Godown Stock, Party Ledger, Worker Hisaab, Upaad |
| `04-owner-cost-estimate.png` | Premium owner | Authenticated Cost Estimate |
| `05-owner-machines.png` | Premium owner | Machines heading, Machine Assignments and empty state |
| `06-owner-worker-hisaab.png` | Premium owner | Worker Hisaab |
| `07-owner-upaad.png` | Premium owner | Upaad (Worker Advance) |
| `08-owner-party-ledger.png` | Premium owner | Party Ledger |
| `09-owner-delivery-challans.png` | Premium owner | Dispatch screen context |
| `10-owner-godown-stock.png` | Premium owner | Godown Stock |
| `11-supervisor-dashboard.png` | Premium supervisor | Metres Produced This Shift, Day/Night shifts and machine helper copy |
| `12-supervisor-machines.png` | Premium supervisor | Machine Board and Machine Assignments |
| `13-owner-add-machine-dialog.png` | Premium owner | Machine Name, Machine Type and technical type values |

Disposable QA fixture:

- run ID: `FORMAL-B2-1784310076133-C262F7`;
- owner and supervisor application login: `PASS`;
- fixture cleanup: `PASS`;
- private credential file removed: `PASS`;
- production access or mutation: `NONE`.

Limit:

The tenant was intentionally empty. Data-dependent labels for Taka quantities,
receipt reconciliation, worker-type assignments and Counter Reading were not
rendered and receive no screenshot-based runtime PASS from this pack.
