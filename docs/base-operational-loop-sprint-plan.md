# Base Operational Loop Sprint Plan

**Decision baseline:** 29 August 2026
**Status:** Sprint 7 implemented and migration applied
**Audience:** Product, design, engineering, QA, and pilot reviewers
**Primary actor:** Organization owner
**Suggested sprint length:** 1–2 weeks per sprint, adjusted to team capacity

## 1. Executive summary

The Base Plan should evolve from a reliable costing desk into a small, useful operating loop:

    factory settings → costing → production job → machine/worker context → machine-first daily production entry → piece-rate pay

The product must not become a smaller copy of the Full Suite. The Base value proposition is a deliberately narrow path from a costing to useful production and worker-pay records. The owner remains the only operational user in the initial release.

The central production decision from the latest discussion is:

> The owner records production by machine for the day or shift. The assigned worker and costing/job are populated automatically from the shift setup, and the worker payroll total is rolled up from the machine rows.

This mirrors the factory reality where a worker may operate two machines with different costing rates. The owner should be able to open one daily sheet, enter metres once per machine, and save the batch without opening separate production forms or repeatedly selecting workers or orders.

The plan below preserves the simple Base experience while introducing only the minimum operational features needed to make costing useful after the quote is created.

## 2. Context and decisions from the product discussions

### 2.1 Why the Base scope is expanding

Costing by itself is valuable but may not be a sufficient core value proposition. A small owner needs a practical next step after calculating a price. Selected operational features from the Full Suite should therefore be available in Base when they complete the costing-to-cash or costing-to-pay loop without introducing factory-management complexity.

The selected Base slice is:

    saved costing → lightweight production job → owner records machine metres → worker piece-rate payable

### 2.2 Onboarding decision

Initial onboarding remains intentionally small:

- configure factory settings and costing assumptions;
- choose the production mode where required;
- enter the owner workspace.

The owner should not be asked to create all machines, workers, shifts, or payroll settings during onboarding. Those objects are only requested when the owner reaches the feature that needs them.

Examples:

- starting production from a costing with no machine opens a small Add Machine dialog;
- opening production logging with no worker opens a small Add Worker dialog;
- assigning workers with no machines offers Add Machine without launching a setup wizard;
- after the missing record is created, the original action resumes automatically.

### 2.3 Owner-only production recording

Production logging remains owner-only for the initial Base release. A supervisor or production-recorder login is deferred until real pilot evidence shows that owner entry is a bottleneck, for example:

- multiple shifts cannot be entered reliably by the owner;
- multiple factories or sites are introduced;
- the daily record volume becomes too large;
- owners need live floor accountability rather than end-of-shift transcription.

### 2.4 Assignment interaction decision

On desktop, connector lines are a desirable primary interaction. They make the worker-to-machine relationship visible and can be more intuitive than a conventional administration table.

On mobile, the same relationship should be represented with tap-to-assign:

    tap worker → choose machine in a bottom sheet → assignment saves

The visual interaction changes by device, but the assignment model and resulting data remain the same.

### 2.5 Daily production entry decision

The owner should not have to choose a production order before entering production.

The daily screen should:

- default to the current date and shift;
- load active machines and their assigned workers automatically;
- show the assigned worker and active production job/order attached to each machine;
- accept metres once per machine in one simple input;
- roll the machine rows up to each worker for payroll;
- calculate a live daily total;
- save the entire shift in one batch.

The order is still important to the system, but it is derived context rather than an entry prerequisite.

## 3. Product principles

1. **Progressive disclosure.** Ask for machines, workers, and payroll details only when the user reaches the relevant workflow.
2. **One primary job per screen.** Creation, assignment, and production entry should be separate simple tasks.
3. **The owner transcribes a shift sheet.** Do not make the owner recreate the supervisor’s process inside the software.
4. **Keep complexity in the system.** Automatic numbering, roster loading, order labels, totals, rate snapshots, and payroll calculations should be handled by the product.
5. **No duplicate entry.** The owner should not enter an order once for the machine and again for every worker.
6. **Preserve historical truth.** Rate, machine, job, and assignment context used at the time of recording must not change when current settings change.
7. **Same capability, device-appropriate interaction.** Desktop can use connectors; mobile should use direct selection.
8. **Base is operationally useful, not operationally complete.** Keep inventory, dispatch, detailed scheduling, supervisors, and advanced payroll for Full Suite.
9. **Small data footprint.** Worker personal information is collected only when necessary.
10. **Every blocked state has one clear next action.** The user should never be sent back to onboarding for a small missing record.

## 4. Current implementation baseline

The following is already implemented or established and should be treated as the starting point for the next work:

- Base onboarding requires factory production mode and a valid Base/Full Suite entitlement, not machine, worker, or payroll setup.
- Full Suite estimator production starts use a contextual loom dialog when no machine exists.
- Base production has an owner-only route at /owner/production.
- Base currently has separate tables for lightweight workers, production jobs, production entries, advances, and payroll settlements.
- Base worker records currently support name, rate per metre, and active/inactive state.
- Base production jobs are linked to immutable saved costing snapshots.
- Base daily production records one worker roll-up per date/shift plus machine/costing allocation rows.
- Costing-specific worker rates and assignment context are snapshotted for historical payroll correctness.
- Existing Base payroll uses machine metres × saved costing rate, with worker-default fallback and the existing 50% advance-recovery cap.
- The Full Suite already contains machine management, machine/order context, shift assignments, production logs, operator payroll, and server-side assignment validation.
- A simple daily-entry pattern already exists in components/DailyEntry.tsx, but it is not yet the production-grade Base workflow.

Relevant implementation references:

- docs/base-production-core-scope.md
- docs/current-onboarding-implementation.md
- app/(dashboard)/owner/production/
- app/(dashboard)/owner/estimator/
- components/MachineManagement.tsx
- components/DailyEntry.tsx
- lib/production-worker-assignment-policy.ts
- supabase/migrations/20260829090000_base_production_core.sql

## 5. Full Suite reuse and refinement assessment

### 5.1 Reuse directly or adapt

The following Full Suite ideas are sufficiently mature to reuse as patterns:

- machine name/type creation and machine status handling;
- tenant-scoped machine queries and server-side owner authorization;
- machine-to-order visibility;
- assignment validation and conflict messaging;
- worker rate snapshots;
- payroll calculation patterns;
- active/inactive worker presentation;
- fixed-footer batch entry behavior;
- existing age-verification and personal-information consent patterns where they are legally or operationally required.

### 5.2 Refine before bringing into Base

The existing Full Suite machine-management experience is machine-first and includes fixed workers, pay modes, shift logic, order assignment, and supervisor concerns. It should not be copied into Base unchanged.

The Base version should be:

- machine-first during daily production entry, with a worker payroll roll-up;
- owner-only;
- limited to meter workers and piece-rate calculation;
- free of fixed-worker payroll, statutory deductions, and supervisor handover;
- able to show machine/order context without requiring order selection;
- simple enough to use after a paper shift sheet is received.

The existing Full Suite shift_assignments and machine_operator_assignments structures also have stronger operational semantics than Base needs. Reuse their validation concepts, but do not expose their full workflow or pay-mode model in Base.

## 6. Scope definition

### 6.1 Base Plan: included in this operational-loop program

- Existing costing, rate book, saved costing history, comparison, and document export.
- Lightweight production jobs created from saved costings.
- Minimal machine records: name, type, optional custom label, active/inactive state.
- Minimal worker records: name, piece rate per metre, active/inactive state.
- Optional worker phone and shift information only when needed.
- Compact compliance/consent capture where required by the existing worker-data policy.
- Owner-only worker-to-machine assignment.
- A worker may be assigned to multiple machines.
- Base may use one primary meter worker per machine/shift; helper and fixed-worker models remain Full Suite.
- Machine-to-active-job visibility.
- Daily or shift-based machine production entry with automatic worker attribution.
- One bulk save for all workers.
- Live daily total.
- Simple piece-rate payroll, advances, and settlement.
- Basic correction before settlement or final lock.
- Clear unassigned/unallocated states.

### 6.2 Full Suite: reserved for the complete operational product

- Formal party-backed quotations and orders.
- Market runs, inventory, godown stock, sales, dispatch, and receivables.
- Supervisor or production-recorder login.
- Live floor production entry by supervisor.
- Dated day/night shift handover and substitution workflows.
- Machine-level meter readings, opening/closing counters, resets, downtime, and reasons.
- Fixed workers, fixed salary, daily/shift pay, statutory deductions, payslips, and payroll controls.
- Complex operator assignment and helper-worker models.
- Machine maintenance, capacity planning, scheduling, and operational alerts.
- Formal approval, lock, audit, and correction consoles.
- Advanced analytics, Factory Today controls, WhatsApp, and automated briefs.
- Advanced production-order allocation, machine counters, and floor-level accountability beyond one costing context per machine.

### 6.3 Explicit Base non-goals

Base must not become a hidden inventory or ERP implementation. The following are out of scope:

- stock movement;
- purchase or sales ledgers;
- dispatch;
- customer/party master;
- GST invoice lifecycle;
- machine maintenance;
- shift scheduling;
- attendance;
- supervisor access;
- fixed-worker payroll;
- detailed downtime/rework/waste capture;
- automated production planning;
- spreadsheet import for initial release.

## 7. Target user workflows

### 7.1 First use

1. Owner signs up and configures factory costing settings.
2. Owner enters Cost Estimate without adding workers or machines.
3. Owner saves a costing.
4. Owner may continue using the costing workspace without operational setup.

### 7.2 Start a production job

1. Owner chooses a saved costing and selects Start Production.
2. Base creates a lightweight production job from the costing snapshot.
3. If no machine exists, the system opens Add Machine.
4. The owner enters the minimum machine details.
5. The machine is created and the original production action resumes.
6. Additional machines, workers, and assignments can wait.

The Base production job is not a formal party order. It is a costing-linked job with a target, dates, status, and planned economics.

### 7.3 Add a machine contextually

Minimum fields:

- machine name or auto-generated number;
- machine type;
- optional custom label.

Recommended defaults:

- default to active/available after creation;
- do not require RPM, power, rate, maintenance, order history, or capacity;
- if opened from a costing/job, show that context read-only rather than asking the owner to reselect it.

The modal should explain that the owner can add more machines and configure assignments later.

### 7.4 Add a worker contextually

Minimum fields:

- worker name;
- rate per metre, because Base payroll depends on it.

Optional fields:

- phone;
- default shift;
- notes or internal label.

Age verification and personal-information consent should be compact and contextual if required. Do not ask for payroll bank details, fixed salary, statutory data, skill matrices, or attendance information in the Base worker dialog.

### 7.5 Assign workers to machines on desktop

The desktop assignment workspace should present:

- Workers column on the left;
- Machines column on the right;
- search in each column;
- active/inactive sections;
- Add Worker and Add Machine actions;
- machine/job badges;
- connector handles on worker and machine rows;
- visible unassigned state.

Primary interaction:

1. Drag from a worker connection handle.
2. Highlight valid machine targets.
3. Release on the machine.
4. Route the connector automatically.
5. Show a saved assignment state and an Undo option.

The system, not the user, should route lines. Users should not manually place nodes or draw free-form paths.

Assignment rules recommended for Base:

- a worker can be connected to multiple machines;
- one machine has at most one primary meter worker for a given shift/context;
- assigning another worker to that machine warns that the current primary assignment will be replaced;
- helper workers and multiple operator types are Full Suite concerns;
- an assignment is a default/current operational context, not a permanent payroll truth;
- the production record stores a snapshot of the assignment context used at entry time.

### 7.6 Assign workers on mobile

Do not compress the two-column canvas into a narrow phone layout. Use a worker-first list:

    Worker 1       Rapier #1 · Job A       Change
    Worker 2       Unassigned              Assign
    Worker 3       Rapier #2 · Job B       Change

Tap Assign or Change:

1. Open a bottom sheet.
2. Search or scan the machine list.
3. Tap a machine.
4. Save immediately.
5. Return to the worker list with a visible assignment chip.

The mobile experience should use the same assignment data as desktop and provide a direct selection fallback for keyboard and accessibility users.

### 7.7 Daily machine production logging

The primary screen should be called Daily Production or Shift Production, not Select Production Order.

Header:

- date, defaulting to today;
- shift, defaulting to the common shift and editable if the factory uses shifts;
- number of active workers;
- total metres entered.

Machine rows:

    Machine             Assigned worker       Costing / rate             Metres
    Rapier #1            Ravi                  Job A · ₹2.50/m             [160]
    Rapier #4            Ravi                  Job B · ₹3.00/m             [160]
    Rapier #2            Meera                 Job A · ₹2.50/m             [     ]

The worker roll-up below the machine rows shows Ravi at 320 m and ₹880.00 gross. The owner enters the two machine values once; the system derives the worker total.

The owner should:

- see all active machines and their assigned workers automatically;
- enter the supervisor’s machine-level metres;
- see the worker total and gross pay roll up live;
- use Enter/Tab to move to the next input on desktop;
- see the total update immediately;
- see missing entries clearly;
- save the whole shift in one action.

Machine, worker, job, and rate labels are read-only context. No worker picker or production-order picker is required before entry. An unassigned machine is visible but cannot receive production until a worker is assigned.

### 7.8 Worker totals versus machine/order allocation

This is the most important domain distinction in the revised plan.

The production source of truth is one value per worker-machine assignment. Base saves a worker/day or worker/shift roll-up for compatibility, plus child allocation rows for every entered machine/costing pair. The system must never duplicate one worker total against every machine or job shown on the sheet.

For a worker on two machines:

    Worker 1 total: 320 m
        Rapier #1 · Job A       [160 m]
        Rapier #4 · Job B       [160 m]

Required Base behavior:

- default to the machine sheet when assignments exist;
- show the assigned worker, machine/job, costing-specific rate, and live row value together;
- derive one worker roll-up from the machine rows;
- require machine allocation totals to equal the worker roll-up before save;
- calculate piece-rate payroll from allocation rows: `Σ(machine metres × rate snapshot)`;
- keep unassigned worker totals possible only as an explicit warning/fallback, never as a silently attributed job allocation;
- preserve a historical worker-total row when older data has no machine split and require a split before correcting it across multiple machines.

This keeps the entry workflow faithful to the factory sheet while preserving accurate job progress and payroll when rates differ by machine/costing.

### 7.9 Daily save and correction

The initial save should be one owner action for the complete batch. The server should store a batch identity for date and shift so retries do not create duplicates.

Recommended Base correction rule:

- owner can edit or correct entries before settlement/finalization;
- settled periods are locked or require an explicit owner correction path;
- corrections record who changed the value and when;
- no supervisor approval console is required in Base.

Blank and zero should be distinct:

- blank = not entered;
- zero = worked but produced zero;
- absent/no production = explicit secondary status.

## 8. Recommended data model

The current Base tables are a useful foundation but the original production entry was job-first and worker-first. The implementation extends the Base model with a daily batch, dated machine/worker context, and allocation snapshots rather than forcing machine-first production through a required job_id on every worker roll-up.

### 8.1 Existing records to retain

- base_production_jobs: costing-linked jobs and planned economics.
- base_production_workers: lightweight meter-worker master data.
- base_worker_advances: Base advances and recovery.
- base_payroll_settlements: Base settlement snapshots.

### 8.2 Machine identity

Use the existing organization-scoped machines identity where it is safe to do so, because machines are factory-level objects and already carry Full Suite machine/order context. Expose only the minimal Base-safe fields and owner actions.

Do not expose Full Suite machine management through Base navigation. If the current shared table permissions cannot support this boundary safely, introduce a Base machine table plus an explicit upgrade bridge before implementation. This is a Sprint 0 technical decision, not something to decide implicitly during UI work.

### 8.3 Base assignment context

Add a small Base assignment relation containing:

- organization ID;
- Base worker ID;
- machine ID;
- optional shift;
- active/effective dates or a current assignment flag;
- created/updated metadata.

The relation must allow one worker to be assigned to multiple machines while enforcing the Base primary-worker rule per machine and shift where that rule is confirmed.

### 8.4 Machine-to-job context

Represent the current Base job attached to a machine with a dated relation rather than overwriting historical production context. A machine may have one active Base job in the MVP. Historical daily records must retain the job label or ID that was visible when the entry was saved.

### 8.5 Daily production batch

Add a batch-level record containing:

- organization ID;
- production date;
- optional shift;
- status: draft, saved, or finalized;
- created/updated metadata;
- idempotency/request identifier.

Use a tenant-scoped uniqueness rule for one active batch per date/shift if the pilot confirms that one daily sheet is the correct unit.

### 8.6 Daily production entry

The entry should contain:

- batch ID;
- Base worker ID;
- worker roll-up metres;
- aggregate rate snapshot for compatibility;
- optional machine/job context when exactly one context is involved;
- assignment/context snapshot;
- allocation mode: worker total or machine breakdown;
- status/notes;
- created/updated metadata.

Machine-first entries use child allocation rows containing machine ID, job/costing ID, assigned worker, metres, rate snapshot, labels, and assignment snapshot. Enforce that allocated metres equal the worker roll-up before commit. Payroll uses the child rows for a machine breakdown and the parent row only for an explicit worker-total fallback—never both.

### 8.7 Historical and payroll invariants

- A rate change affects future entries only.
- An assignment change does not rewrite prior daily logs.
- A machine changing from Job A to Job B does not change old entries.
- A worker becoming inactive does not delete history.
- A payroll settlement uses stored machine/costing rate snapshots when allocations exist, otherwise the parent worker-rate snapshot.
- A retry of the same daily batch is idempotent.
- A worker total is never duplicated across multiple visible jobs without an explicit allocation.

## 9. Server, security, and reliability requirements

All new actions must preserve the current tenant and owner boundaries.

- Require an authenticated owner and a valid Base/Full Suite entitlement.
- Scope every read and write by org_id server-side.
- Preserve RLS on every new table.
- Do not trust client-provided totals, payroll amounts, organization IDs, worker rates, or job ownership.
- Use a server-side batch operation or transaction for saving a daily sheet.
- Validate worker activity, machine ownership, assignment validity, date/timezone, and job status.
- Validate every machine allocation against the dated assignment and machine-to-job context.
- Resolve worker, job/costing, rate, labels, and assignment snapshots server-side; never trust client-supplied payroll context.
- Enforce `sum(machine allocation metres) = worker roll-up metres` and reject duplicate machine/costing pairs.
- Use idempotency keys for daily batch submission.
- Snapshot rate and context at write time.
- Return actionable errors that identify the missing setup without exposing raw database details.
- Do not make service-role credentials available to the browser.
- Add audit records for corrections and settlement locks if the existing audit infrastructure supports them.

## 10. Sprint plan

### Sprint 0 — Product contract, paper-sheet validation, and technical decision gate

**Goal:** Lock the smallest correct model before schema or visual implementation.

Deliverables:

- confirm the exact supervisor sheet format;
- decide whether the normal input is worker total or worker-machine total;
- confirm whether one machine can have more than one primary meter worker in the same shift in Base;
- confirm whether shift is required, optional, or simply defaults to Day;
- decide whether Base assignments are standing defaults or dated shift assignments;
- choose shared machines versus a Base machine table;
- approve desktop connector and mobile tap-to-assign wireframes;
- approve daily production sheet wireframe;
- write domain invariants and examples for one worker on one, two, and three machines.

Acceptance criteria:

- a product decision exists for worker total versus worker-machine detail;
- no screen requires production-order selection before daily entry;
- the Base/Full Suite boundary is signed off;
- the data model can represent the pilot’s real paper sheet without invented allocations.

### Sprint 1 — Schema and domain foundation

**Goal:** Create the minimum durable model for machines, assignments, daily batches, and historical context.

Tasks:

- add or adapt Base machine access;
- add Base worker-machine assignments;
- add machine-to-Base-job context;
- add daily batch and entry relations;
- add machine/costing allocation rows for machine-first payroll and job progress;
- backfill current Base production entries into the new shape;
- preserve existing job, worker, rate, advance, and settlement records;
- add tenant-scoped indexes and RLS policies;
- add database checks for dates, active records, duplicate batches, and rate snapshots;
- add idempotent batch-save RPC/action support.

Acceptance criteria:

- existing Base production history remains readable;
- a worker can have multiple machine assignments;
- historical records retain their original context;
- a daily batch can be saved atomically and retried safely;
- direct cross-tenant or non-owner access is rejected;
- migration tests cover both empty and existing organizations.

### Sprint 2 — Contextual machine and worker setup

**Goal:** Make operational setup available without adding onboarding burden.

Tasks:

- refine Add Machine modal to type, name/number, and optional label;
- add auto-numbering with collision-safe server validation;
- refine Add Worker modal to name and rate, with optional phone/shift;
- retain compact age/consent checks where required;
- support active/inactive state without deletion pressure;
- add contextual setup messages from production, assignment, and job flows;
- resume the original action after successful setup;
- show set up later guidance without blocking unrelated costing tasks.

Acceptance criteria:

- a new Base owner can create a costing without creating a machine or worker;
- starting the first production job prompts only for a missing machine;
- opening daily production prompts only for a missing worker;
- setup dialogs are usable at desktop and mobile widths;
- no Full Suite payroll or supervisor fields appear in Base setup.

### Sprint 3 — Desktop assignment canvas

**Goal:** Deliver the connector-line interaction as a polished, controlled desktop experience.

Tasks:

- build two-column Worker and Machine workspace;
- add search, active/inactive filtering, and unassigned filtering;
- render worker and machine nodes with clear connection handles;
- implement drag-to-connect with automatic routing;
- highlight valid targets while dragging;
- prevent invalid duplicate or conflicting assignments;
- show current machine/job badges;
- support click-to-assign and keyboard-accessible fallback;
- support unassign, reassign, and Undo;
- keep node positions deterministic rather than user-managed.

Acceptance criteria:

- an owner can assign one worker to three machines without creating duplicate records;
- assigning a new primary worker produces a clear conflict message;
- lines remain readable with the pilot’s expected worker/machine count;
- search and filters do not silently hide the meaning of existing assignments;
- assignment changes are persisted and survive reload;
- connector interaction does not become a free-form diagram editor.

### Sprint 4 — Mobile assignment flow

**Goal:** Preserve the same assignment capability with low-friction touch interaction.

Tasks:

- create the worker-first mobile list;
- show assignment chips for machine and active job;
- add Assign/Change actions;
- implement searchable bottom-sheet machine selection;
- save assignment with immediate feedback and Undo;
- add machine-first access as a secondary entry point if pilot behavior requires it;
- meet touch target and accessibility requirements;
- test with inactive and unassigned records.

Acceptance criteria:

- a worker can be assigned to a machine in three intentional taps or fewer after opening the screen;
- a worker with multiple machines can see all assignments without opening a desktop-only view;
- mobile does not require drag, long-press, pinch, or horizontal scrolling;
- desktop and mobile produce identical assignment records.

### Sprint 5 — Daily machine production sheet

**Goal:** Replace one-worker-at-a-time production entry with a machine-first daily batch workflow.

Tasks:

- rename and position the screen around Daily Production or Shift Production;
- default date and shift;
- load active machines and their assigned workers automatically;
- display machine/job/costing-rate context as read-only fields;
- provide one metres input per assigned machine;
- derive worker totals from machine rows;
- support keyboard flow and numeric input;
- show entered count, outstanding count, and live total;
- distinguish blank, zero, absent, and no production;
- show unassigned machines and allow an explicitly warned unassigned worker fallback;
- save the complete batch atomically;
- show a confirmation summary;
- add same-day correction before settlement/finalization;
- handle duplicate submission and network retry.

Acceptance criteria:

- the owner does not select a production order before entering the sheet;
- ten machines can be entered without opening separate forms;
- the owner can enter machines associated with different workers and costings in one batch;
- a worker assigned to multiple machines has one live roll-up while each machine remains a separate source row;
- payroll totals use each machine allocation exactly once;
- batch totals reconcile to the sum of saved machine allocations and worker roll-ups;
- failed saves do not create partial or duplicate records.

### Sprint 6 — Payroll, job visibility, and basic history

**Goal:** Turn saved daily production into a trustworthy worker-pay result without exposing Full Suite payroll complexity.

Tasks:

- reuse the existing worker-rate snapshot calculation as the legacy fallback;
- calculate gross piece-rate pay from machine allocation metres × costing-specific rate snapshots;
- preserve the 50% advance-recovery cap;
- update payables from daily batches;
- keep settlement and payment modes simple;
- show production totals by worker and date range;
- show machine/job context where available;
- show machine/costing allocation context in worker history;
- provide Base job progress from explicitly attributed machine metres;
- lock or gate corrections after settlement.

Acceptance criteria:

- a rate change does not rewrite prior payroll;
- advances and settlements reconcile with batch entries;
- a worker’s multi-machine total is not counted twice;
- the owner can see what is paid, unpaid, and still owed;
- no fixed-worker or statutory payroll fields appear in the Base workflow.

### Sprint 7 — Machine-first allocation and costing-aware payroll

**Goal:** Make the machine the daily production source of truth while automatically attributing output to the assigned worker and costing-specific pay rate.

**Status:** Implemented in the owner UI, server actions, domain calculations, and forward database migration.

This sprint is required for the pilot’s real payroll case: one worker can operate two machines with different costings and therefore different rates. For example, 160 m on Rapier #1 at ₹2.50/m plus 160 m on Rapier #4 at ₹3.00/m produces 320 m and ₹880 gross pay.

Implementation:

- show one production input per active machine for the selected date and shift;
- populate the assigned worker, active costing/job, and costing-specific rate from dated setup context;
- keep a worker roll-up row for status, total metres, and gross pay;
- persist the worker roll-up for compatibility and child machine/costing allocation rows as the payroll source;
- snapshot the resolved worker, machine, job/costing, assignment, labels, and rate on every allocation;
- require allocation metres to equal the worker roll-up and reject duplicate machine/costing pairs;
- derive all assignment and rate context server-side and reject stale or cross-tenant machine/job combinations;
- calculate job progress from explicitly attributed allocation metres without double counting the parent roll-up;
- keep legacy worker-total rows readable and payable, while requiring a machine split before correcting an ambiguous historical multi-machine total;
- lock corrections after settlement or batch finalization and retain idempotent batch-save behavior.

Acceptance criteria:

- a worker can produce on two assigned machines at different costing rates and payroll equals the sum of both machine rows;
- the owner never re-enters the worker or chooses a production order for an assigned machine row;
- the server, not the browser, determines the assigned worker, job, rate, labels, and historical snapshots;
- child allocation totals equal the worker roll-up and never create duplicate payroll or job progress;
- rate changes and assignment changes affect future records only;
- direct allocation-table writes are blocked and tenant/owner/RLS boundaries remain intact;
- a retry of the same date/shift save is idempotent and a settled/finalized batch cannot be changed.

### Sprint 8 — Pilot hardening and release evidence

**Goal:** Prove the complete Base operational loop without introducing bloat.

Tasks:

- unit-test calculations, totals, assignment rules, and allocation invariants;
- test RLS, owner role, entitlement, and tenant isolation;
- test empty-state contextual setup;
- test desktop connector assignment with realistic record counts;
- test mobile tap assignment on 320–480px widths;
- test daily batch save, retry, partial network failure, and duplicate submission;
- test timezone/date boundaries in Asia/Kolkata;
- test correction and settlement locking;
- test English, Hindi, and Gujarati wording;
- run TypeScript, lint, focused tests, full tests, and production build;
- run authenticated browser evidence for costing → job → setup → assignment → daily log → payroll;
- record pilot feedback and stop-line issues.

Release gate:

- no additional onboarding steps are required;
- an owner can complete the operational loop with a real paper shift sheet;
- the common path has one obvious next action at every step;
- no inventory, supervisor, or Full Suite setup is accidentally required;
- payroll and historical context remain correct after edits, retries, and rate changes.

## 11. UX copy and terminology

Recommended Base language:

- Cost Estimate
- Saved Costings
- Production Job
- Daily Production
- Worker
- Machine or Loom, based on the approved factory glossary
- Assigned machine
- Unassigned
- Add machine to continue
- Add worker to record production
- Metres produced
- Save machine production
- Worker payroll roll-up
- Costing rate
- Unassigned machine
- Unallocated worker entry

Avoid in Base:

- operator assignment;
- production order selection as a required first step;
- payroll cycle;
- fixed worker;
- statutory deductions;
- floor accountability;
- machine capacity planning;
- supervisor handover.

## 12. Success measures

These are pilot hypotheses to validate, not hard promises:

- first-time Base setup requires no machine or worker records;
- first machine or worker can be created in under one minute when contextually requested;
- an owner can assign the pilot’s normal worker/machine roster without training;
- ten machine production values can be entered in one daily sheet without opening separate forms;
- daily batch save takes one submission and produces one clear confirmation;
- a rate update does not change historical payables;
- no duplicate metres appear in payroll or job summaries;
- a worker operating two machines at different rates receives the exact sum of both machine allocations;
- support feedback does not identify the Base production screen as an ERP-style burden;
- pilot users can explain the difference between worker total and job allocation.

## 13. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Connector lines become cluttered | Automatic routing, stable columns, filters, unassigned view, click fallback |
| Mobile drag interaction is frustrating | Use tap-to-assign bottom sheet, not a compressed graph |
| A worker operates machines with different rates | Capture one value per machine, snapshot the costing rate, and roll up to the worker once |
| Older worker totals cannot be allocated to multiple jobs | Preserve the historical total, show it as unallocated, and require an explicit machine split before correction |
| Assignment changes rewrite historical meaning | Snapshot assignment and job context on the production record |
| Full Suite tables leak complexity into Base | Reuse server invariants, not the full supervisor/payroll UI |
| Onboarding becomes a setup wizard | Contextual modals with automatic resume |
| Duplicate batch saves create duplicate payroll | Tenant-scoped batch uniqueness and idempotency keys |
| Rate changes rewrite past pay | Store rate snapshots on every entry |
| Missing machine assignment blocks legitimate payroll entry | Allow worker total with a clear unassigned warning when policy permits |
| Existing Base job-first schema resists daily logging | Add a daily batch model and backfill safely rather than overloading the old form |
| Privacy burden grows with worker profiles | Keep phone optional and collect compliance fields only when required |

## 14. Open questions requiring product confirmation

The plan uses recommended assumptions, but these questions should be answered in Sprint 0:

1. Does the supervisor’s real sheet provide one value per worker-machine assignment, and can the owner receive that split reliably?
2. In the Base use case, can one machine have more than one primary meter worker in the same shift, or should Base enforce one?
3. Should Base assignments be standing defaults, dated daily assignments, or shift-specific assignments?
4. Is a shift always relevant, or should Base default to a single daily record and expose shift only when enabled?
5. Should a Base machine be attached to only one active Base production job at a time?
6. Is worker payroll calculated from each machine allocation’s costing rate, with worker-default fallback only when a costing has no rate?
7. Should a worker be allowed to be logged with production when no machine assignment exists, with the record marked unallocated?

Recommended defaults if the pilot does not answer these immediately:

- one machine-level value per active assigned machine, with one worker roll-up per date/shift;
- one primary meter worker per machine/shift;
- one worker may operate multiple machines;
- shift defaults to Day but remains editable;
- one active Base job per machine;
- payroll uses machine allocation metres × costing rate snapshots;
- missing assignment warns but does not block worker-level pay entry.

## 15. Definition of done

The Base operational loop is ready when:

1. A new owner can complete costing onboarding without machines, workers, or payroll setup.
2. The owner can create a production job from a saved costing.
3. Missing machines and workers are requested contextually and the original action resumes.
4. A desktop owner can connect workers to machines with connector lines.
5. A mobile owner can create the same assignment through tap-to-assign.
6. The owner can open one daily sheet and enter production for all active assigned machines.
7. No production-order selection is required before daily entry.
8. Machine and job context is visible without forcing repeated data entry.
9. Multi-machine worker totals are not silently duplicated.
10. Payroll uses immutable costing/machine rate snapshots, worker-default fallback, and existing advance rules.
11. Corrections, retries, and settlement boundaries are understandable.
12. RLS, tenant isolation, entitlements, idempotency, and server-side calculations are verified.
13. The Base navigation remains small and Full Suite boundaries remain intact.
14. Pilot evidence supports the feature value without showing that the workflow has become bloated.

## 16. Related documents

- [Base Production Core scope](base-production-core-scope.md)
- [Current onboarding implementation](current-onboarding-implementation.md)
- [Base Plan Simplification Program](base-plan-simplification/README.md)
- [Base Plan user workflows](engineer-handoff/03-base-plan-user-workflows.md)
- [Base estimator refinement sprint plan](base-estimator-refinement-sprint-plan.md)
- [Full Suite production-worker assignment policy](../lib/production-worker-assignment-policy.ts)
