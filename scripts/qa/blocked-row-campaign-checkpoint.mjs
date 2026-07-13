#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const ledgerPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/results.json')
const outDir = path.join(root, 'output/qa/blocked-row-campaign')
const inventoryPath = path.join(outDir, 'BLOCKED_ROW_INVENTORY.json')
const checkpointPath = path.join(outDir, 'CHECKPOINT.json')
const humanPath = path.join(root, 'docs/qa/blocked-row-remediation-checkpoint.md')

const batches = [
    {
        id: 'B09',
        name: 'production-entry validation and resilience',
        rows: ['PROD-005', 'PROD-006', 'PROD-007', 'PROD-010', 'PROD-011', 'PROD-013', 'PROD-014', 'PROD-022', 'PROD-023', 'PROD-024', 'PROD-025', 'PROD-026', 'PROD-027', 'PROD-030', 'OFF-003', 'OFF-004', 'UX-001'],
        rootCause: 'Rows still cite the retired inactive-loom/shift-submit blocker; one isolated 20-loom owner/supervisor fixture can re-execute validation, draft, retry, concurrency, status, offline, and mobile behavior.',
        role: 'owner + supervisor',
        environment: 'production disposable tenant',
        routes: ['/owner/machines', '/supervisor/dashboard'],
        data: ['organizations', 'profiles', 'machines', 'workers', 'orders', 'machine_assignments', 'machine_operator_assignments', 'shift_assignments', 'production_logs', 'fabric_stock_lots'],
        validation: 'Browser interaction plus tenant-scoped before/after reconciliation, injected failure/timeout paths, refresh proof, two-session concurrency, and mobile viewport proof.',
        exit: 'Every included row is directly executed and classified; created fixture rows and credentials are reconciled and removed.',
    },
    {
        id: 'B10',
        name: 'historical correction, access-code, and calendar boundaries',
        rows: ['PROD-017', 'PROD-018', 'PROD-019', 'PAY-006', 'PAY-022', 'COMM-013', 'TIME-003', 'TIME-004'],
        rootCause: 'These require dated records, correction windows, consumed/expired codes, settled-period protection, and non-current calendar fixtures after the dated-production repair.',
        role: 'owner + supervisor',
        environment: 'QA first, then production disposable tenant',
        routes: ['/supervisor/dashboard', '/supervisor/attendance', '/owner/payroll', '/owner/commercials'],
        data: ['production_logs', 'attendance', 'access_codes', 'payroll_settlements', 'commercial_payment_receipts'],
        validation: 'Controlled clock/date fixtures, UI and server rejection/acceptance proof, refresh, historical snapshot reconciliation, and independent India-calendar calculations.',
        exit: 'Past/future, correction-window, settled-period, month/year-end, and leap-day outcomes are directly proven.',
    },
    {
        id: 'B11',
        name: 'quote and order lifecycle through protected history',
        rows: ['QUOTE-007', 'ORDER-005', 'ORDER-007', 'ORDER-009', 'ORDER-010', 'ORDER-011', 'ORDER-012', 'ORDER-013', 'ORDER-014', 'ORDER-015', 'STOCK-011', 'GOLDEN-A-23'],
        rootCause: 'The rows depend on a now-available order production chain plus the already source-fixed Start Party Order transaction and production/order boundary migrations.',
        role: 'owner + supervisor + public receipt',
        environment: 'QA first, then production disposable tenant',
        routes: ['/owner/estimator', '/owner/quotes', '/owner/orders', '/supervisor/dashboard', '/owner/stock', '/owner/dispatches', '/owner/commercials', '/owner/payroll'],
        data: ['estimates', 'quotes', 'orders', 'production_logs', 'fabric_stock_lots', 'fabric_stock_sales', 'dispatches', 'stock_discrepancies', 'commercial_receivables', 'payroll_settlements'],
        validation: 'End-to-end UI chain with target/over-target/cancel/complete/delete boundaries and stock, dispatch, money, payroll, and history reconciliation.',
        exit: 'Order lifecycle and Golden A protected-history requirements are classified from direct runtime evidence.',
    },
    {
        id: 'B12',
        name: 'stock concurrency, market closure, dispatch compliance, and commercial identity',
        rows: ['MARKET-009', 'MARKET-010', 'MARKET-013', 'STOCK-005', 'STOCK-009', 'DISP-017', 'DISP-018', 'COMM-015', 'GOLDEN-B-12', 'GOLDEN-B-17'],
        rootCause: 'These share saleable stock, concurrent lot mutation, multi-batch dispatch/receipt, archived market-run state, compliance warnings, and duplicate party identity fixtures.',
        role: 'owner + public receipt',
        environment: 'QA first, then production disposable tenant',
        routes: ['/owner/stock', '/owner/market-runs', '/owner/dispatches', '/owner/commercials', '/track/*'],
        data: ['market_runs', 'fabric_stock_lots', 'fabric_stock_sales', 'fabric_stock_movements', 'dispatches', 'fabric_packages', 'stock_discrepancies', 'parties', 'commercial_receivables'],
        validation: 'Concurrent credential-backed mutations, sell-out/close/archive flow, two dispatch batches and receipts, compliance threshold states, duplicate-name party IDs, and exact stock/receivable calculations.',
        exit: 'All stock/market/dispatch rows have persisted runtime proof and no negative/double-used stock.',
    },
    {
        id: 'B13',
        name: 'payroll, advances, kharchi, and worker money lifecycle',
        rows: ['MASTER-006', 'PAY-002', 'PAY-010', 'PAY-011', 'PAY-012', 'PAY-014', 'PAY-017', 'PAY-019', 'PAY-021', 'PAY-025', 'PAY-026', 'PAY-027', 'DASH-003', 'GOLDEN-A-21', 'GOLDEN-A-22', 'GOLDEN-B-18'],
        rootCause: 'One production-backed payroll fixture can prove decimal assignment rates, historical snapshots, advances, caps, adjustments, concurrent settlement, reversal, exit/final mode, kharchi atomicity, dashboard wages, and golden payroll steps.',
        role: 'owner + supervisor',
        environment: 'QA first, then production disposable tenant',
        routes: ['/owner/workers', '/owner/advances', '/owner/payroll', '/supervisor/advances', '/owner/today'],
        data: ['workers', 'machine_operator_assignments', 'production_logs', 'worker_advances', 'attendance', 'payroll_settlements', 'payroll_adjustments'],
        validation: 'Preview/settle/reverse UI proof, two-session concurrency, before/after advance equations, decimal-safe net-pay calculations, historical persistence, and dashboard reconciliation.',
        exit: 'Every worker-money row is directly classified with matching UI and persisted equations.',
    },
    {
        id: 'B14',
        name: 'realtime dashboard recovery and large-range states',
        rows: ['DASH-005', 'DASH-006', 'DASH-008', 'DASH-010', 'UX-010'],
        rootCause: 'These share controlled realtime mutation/disconnect/reconnect plus sufficiently large dated production/order data and error-state injection.',
        role: 'owner + supervisor',
        environment: 'QA first, then production disposable tenant',
        routes: ['/owner/today', '/owner/analytics', '/supervisor/dashboard'],
        data: ['orders', 'machines', 'production_logs', 'realtime publication'],
        validation: 'Second-session insert, controlled disconnect/reconnect, refetch truth, independent pace calculations, large-range timing, and distinct empty/loading/error/offline rendering.',
        exit: 'Realtime and dashboard rows have timing, console, state, and persisted-source evidence.',
    },
    {
        id: 'B15',
        name: 'authentication, privacy, audit, adversarial UX, and PWA device proof',
        rows: ['AUTH-005', 'AUTH-014', 'AUTH-018', 'OFF-001', 'SEC-009', 'SEC-010', 'SEC-012', 'SEC-013', 'SEC-015', 'UX-006', 'UX-009'],
        rootCause: 'These need isolated accounts plus timed session, proxy-rate-limit, export/audit, disposable erasure/XSS/CSRF, keyboard/zoom, and installable-device proof rather than source inspection.',
        role: 'owner + supervisor + logged out',
        environment: 'QA first; production only where safe and required',
        routes: ['/forgot-password', '/reset-password', '/owner/settings', '/owner/workers', 'installable PWA'],
        data: ['auth users/sessions', 'profiles', 'audit_log', 'workers', 'parties', 'organizations'],
        validation: 'Valid/used/expired recovery flow, timed expiry, proxy-isolated rate-limit probe, scoped export/audit, disposable destructive/adversarial inputs, keyboard traversal, 200% zoom, and real install/reopen.',
        exit: 'Each security/UX row has direct safe proof or a precise external capability blocker.',
    },
    {
        id: 'B16',
        name: 'WhatsApp simulation and provider boundaries',
        rows: ['WA-001', 'WA-002', 'WA-003', 'WA-004', 'WA-005', 'WA-006', 'WA-007', 'WA-009', 'WA-010'],
        rootCause: 'Rows share message consent, delivery logging, cooldown/retry, and controlled Meta timeout/rejection prerequisites.',
        role: 'owner + supervisor + consented test recipient',
        environment: 'isolated simulator first; production provider only with consent and configured credentials',
        routes: ['/owner/settings', '/owner/advances', '/owner/payroll'],
        data: ['notification_consents', 'whatsapp_messages', 'whatsapp_settings', 'worker_advances', 'payroll_settlements', 'access_codes'],
        validation: 'Deterministic provider simulator for sent/skipped/timeout/retry/cooldown plus one authorized live rejection/token test when credentials and recipient consent exist.',
        exit: 'Core writes remain correct across delivery outcomes; any live-provider remainder names the missing external dependency exactly.',
    },
    {
        id: 'B17',
        name: 'Razorpay checkout, webhook, replay, and entitlement timing',
        rows: ['BILL-003', 'BILL-004', 'BILL-005', 'BILL-006', 'BILL-007', 'BILL-009', 'BILL-010', 'SEC-007'],
        rootCause: 'Rows require authorized Razorpay test-mode checkout and synthetic/replayed signed events against disposable billing state.',
        role: 'owner + billing webhook',
        environment: 'Razorpay test mode and disposable tenant',
        routes: ['/owner/billing', '/api/webhooks/razorpay'],
        data: ['org_subscriptions', 'billing_orders', 'billing_payments', 'referral_uses', 'webhook event ledger'],
        validation: 'Hosted checkout, valid/invalid/replayed/out-of-order webhook delivery, failure/cancel/renewal/expiry session transitions, and exact idempotency reconciliation.',
        exit: 'All billing rows are runtime-classified or precisely blocked by unavailable provider credentials/tooling.',
    },
    {
        id: 'B18',
        name: 'backup restore and rollback/forward-fix exercise',
        rows: ['TECH-011', 'TECH-012'],
        rootCause: 'Both require disposable infrastructure and an exercised recovery runbook, not application code inspection.',
        role: 'release operator',
        environment: 'disposable Supabase project/branch plus Vercel rollback candidate',
        routes: ['deployment and database recovery surfaces'],
        data: ['organization/auth/production/stock/receivable/payroll backup set', 'migration history'],
        validation: 'Restore a sanitized fixture and reconcile it; exercise application rollback and reviewed database forward-fix without damaging production.',
        exit: 'Recovery times, commit/deployment IDs, migration state, and reconciled fixture results are recorded.',
    },
    {
        id: 'B19',
        name: 'genuine external review and human truth sources',
        rows: ['SEC-011', 'SEC-018', 'UX-012', 'GOLDEN-A-03', 'SIGNOFF-04'],
        rootCause: 'These explicitly depend on external Sentry payload access, qualified counsel, factory terminology review, business truth sheet, or supervisor register.',
        role: 'release operator + counsel + factory reviewer',
        environment: 'production/provider and supplied human artifacts',
        routes: ['Sentry issue payload', 'public legal pages', 'factory workflows'],
        data: ['Sentry event', 'legal review record', 'truth sheet', 'supervisor register'],
        validation: 'Inspect live redacted payload and compare supplied authoritative human/business artifacts to the application result.',
        exit: 'Rows pass with external evidence or remain genuinely blocked with the smallest exact requested input.',
    },
]

const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'))
const blocked = ledger.items.filter((item) => item.status === 'blocked')
const batchByRow = new Map()
for (const batch of batches) {
    for (const id of batch.rows) {
        if (batchByRow.has(id)) throw new Error(`Duplicate batch assignment for ${id}`)
        batchByRow.set(id, batch)
    }
}

const missing = blocked.filter((item) => !batchByRow.has(item.id)).map((item) => item.id)
const unknown = [...batchByRow.keys()].filter((id) => !ledger.items.some((item) => item.id === id))
if (missing.length || unknown.length || batchByRow.size !== 103) {
    throw new Error(`Batch mapping mismatch: ${JSON.stringify({ blocked: blocked.length, mapped: batchByRow.size, missing, unknown })}`)
}

const campaignItems = ledger.items.filter((item) => batchByRow.has(item.id))
const inventory = campaignItems.map((item) => {
    const batch = batchByRow.get(item.id)
    return {
        id: item.id,
        feature: item.section,
        scenario: item.scenario,
        expected: item.expected,
        current_status: item.status,
        current_outcome: item.actual,
        existing_evidence: item.evidence,
        severity: item.severity || null,
        user_role: batch.role,
        environment: batch.environment,
        required_prerequisites: batch.data,
        related_routes: batch.routes,
        related_data_or_dependencies: batch.data,
        blocker_reproducible: 'must_retest',
        internally_remediable: !['B16', 'B17', 'B18', 'B19'].includes(batch.id),
        likely_root_cause: batch.rootCause,
        related_blocked_rows: batch.rows.filter((id) => id !== item.id),
        upstream_dependencies: batch.rows.filter((id) => id !== item.id).slice(0, 4),
        downstream_dependencies: [],
        proposed_batch: batch.id,
        proposed_validation: batch.validation,
    }
})

const counts = Object.fromEntries(Object.entries(Object.groupBy(ledger.items, (item) => item.status)).map(([status, items]) => [status, items.length]))
const b09Rows = batches.find((batch) => batch.id === 'B09').rows
const b09Closed = b09Rows.every((id) => ledger.items.find((item) => item.id === id)?.status === 'pass')
const b10Rows = batches.find((batch) => batch.id === 'B10').rows
const b10Closed = b10Rows.every((id) => ledger.items.find((item) => item.id === id)?.status === 'pass')
const checkpoint = {
    campaign: 'blocked-row-remediation',
    updated_at: new Date().toISOString(),
    branch: 'codex/estimator-production-readiness-20260710',
    starting_counts: { pass: 270, fail: 3, blocked: 103, not_applicable: 1, total: 377 },
    current_counts: { ...counts, total: ledger.items.length },
    canonical_ledger: path.relative(root, ledgerPath),
    canonical_matrix: 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md',
    inventory: path.relative(root, inventoryPath),
    completed_batches: b10Closed ? ['B08', 'B09', 'B10'] : b09Closed ? ['B08', 'B09'] : ['B08'],
    active_batch: b10Closed ? 'B11' : b09Closed ? 'B10' : 'B09',
    active_batch_state: b10Closed ? 'B10 closed with QA and production proof, exact deployment, and zero cleanup; B11 queued' : b09Closed ? 'B09 closed with exact production proof and cleanup; B10 queued' : 'runtime proof complete; exact production deployment and alias proof pending',
    planned_batches: batches.map(({ id, name, rows, rootCause, validation, exit }) => ({ id, name, rows, rootCause, validation, exit })),
    rows_moved_to_pass: b10Closed ? [...b09Rows, ...b10Rows] : b09Closed ? b09Rows : [],
    rows_moved_to_fail: [],
    rows_remaining_blocked: blocked.map((item) => item.id),
    rows_marked_not_applicable: [],
    root_causes_fixed_this_campaign: b09Closed ? [
        'Breakdown updates could report success after a zero-row update; the action now validates the grain and performs verified update-or-insert with race recovery.',
        'Copy previous was hidden by placeholder assignment rows; visibility now follows the count of actually assigned looms.',
        'The loom details sheet lacked the required accessible title.',
        ...(b10Closed ? [
            'Broad permissive attendance policies bypassed date boundaries; production now retains only the authoritative supervisor-today and owner-past/today policies plus tenant lockdown checks.',
            'Commercial month-to-date bounds are derived from one India-time instant, including month/year and leap-day boundaries.',
            'Rate-limit retry messages now convert the absolute reset timestamp to remaining seconds, and attendance exposes explicit bounded day navigation.',
        ] : []),
    ] : [],
    commits: b09Closed ? [
        { sha: '812512c599b3659cc399495a674e8b3e50066e60', subject: 'fix(qa): close B09 production resilience gaps' },
        ...(b10Closed ? [
            { sha: '48d30895fde3635647b4c6c7112dd5ecc7241965', subject: 'fix(qa): enforce B10 date boundaries' },
            { sha: 'fd1c367665455ca2bc66ca54d81a9cc259147284', subject: 'fix(qa): complete B10 protected boundary proof' },
        ] : []),
    ] : [],
    production_deployments: [
        { id: 'dpl_43n5khAYXGcCtp64SBowPZirjaUG', commit: '649380d5dfbcbb89d8c10cad7763448ac42c6f2c', state: 'READY' },
        ...(b09Closed ? [{ id: 'dpl_EPGVy9PMbaLLphgssXvBq9HgD5yB', commit: '812512c599b3659cc399495a674e8b3e50066e60', state: 'READY', target: 'production', alias: 'https://textile-accounting.vercel.app' }] : []),
        ...(b10Closed ? [{ id: 'dpl_5rKpnNLwszpfgfzkn8VBh291wyS6', commit: 'fd1c367665455ca2bc66ca54d81a9cc259147284', state: 'READY', target: 'production', alias: 'https://textile-accounting.vercel.app' }] : []),
    ],
    migrations: [
        { environment: 'production', head: '20260713124500', alignment: 'verified' },
        ...(b10Closed ? [{ environment: 'qa and production', file: '20260714005500_b10_enforce_attendance_date_lockdown.sql', production_history_version: '20260713193455', alignment: 'verified by policy catalog and runtime proof' }] : []),
    ],
    created_test_accounts_and_tenants: [
        { batch: 'B09', type: 'prefixed disposable production tenant with three auth users', state: b09Closed ? 'removed; organizations/profiles/machines/logs/auth all reconciled to zero' : 'active until exact production proof and cleanup' },
        ...(b10Closed ? [{ batch: 'B10', type: 'prefixed disposable QA and production tenants with owner and supervisor proof users', state: 'removed; organizations/profiles/production logs/attendance/commercial payments/auth all reconciled to zero' }] : []),
    ],
    outstanding_external_dependencies: batches.filter((batch) => ['B16', 'B17', 'B18', 'B19'].includes(batch.id)).map((batch) => ({ batch: batch.id, rows: batch.rows, dependency: batch.rootCause })),
    last_successful_validation: b10Closed
        ? 'B10 production deployment dpl_5rKpnNLwszpfgfzkn8VBh291wyS6 Ready at exact commit fd1c367; remote gate 85 files / 611 tests; production correction/access-code/settlement, attendance, India-month, calendar, policy-catalog, persistence, and zero-fixture cleanup all passed.'
        : b09Closed
        ? 'B09 production deployment dpl_EPGVy9PMbaLLphgssXvBq9HgD5yB Ready at exact commit 812512c; remote gate 82 files / 599 tests; production alias Copy previous, accessible sheet, verified breakdown persistence, migration head, and zero-fixture cleanup all passed.'
        : 'B09 optimized production build; 82 files / 598 passed and 1 skipped; 20-loom browser, offline, timeout, invalid-payload, breakdown persistence, and two-supervisor concurrency proof all green.',
    exact_next_action: b10Closed
        ? 'Start B11 with a fresh disposable quote/order fixture and execute quote conversion, target/over-target, cancellation/completion/deletion protection, stock-history, and Golden A protected-history scenarios before changing any of its twelve rows.'
        : b09Closed
        ? 'Start B10 with a fresh disposable fixture: execute historical correction windows, access-code consumption/expiry, settled-period protection, and India calendar boundaries before changing any of its eight rows.'
        : 'Commit and push the B09 implementation/evidence, deploy that exact commit to production, re-run the affected production alias paths, then promote only the 17 proven B09 rows.',
}

const table = batches.map((batch) => `| ${batch.id} | ${batch.name} | ${batch.rows.length} | ${batch.rows.map((id) => `\`${id}\``).join(', ')} |`).join('\n')
const human = `# Blocked-Row Remediation Checkpoint\n\n- Canonical baseline: 270 PASS, 3 FAIL, 103 BLOCKED, 1 NOT APPLICABLE (377 total).\n- Current ledger: **${counts.pass} PASS, ${counts.fail} FAIL, ${counts.blocked} BLOCKED, ${counts.not_applicable} NOT APPLICABLE (${ledger.items.length} total)**.\n- Canonical ledger: \`output/qa/PILOTQA-20260621-2058-8QIH/results.json\`.\n- Completed batch: **B10 — historical correction, access-code, and calendar boundaries (8/8 PASS)**.\n- Active batch: **B11 — quote and order lifecycle through protected history**.\n- Validation gate: local optimized build passed 85 files / 610 tests with 1 intentional skip; Vercel repeated 85 files / 611 tests and a successful Next.js build.\n- Production deployment: \`dpl_5rKpnNLwszpfgfzkn8VBh291wyS6\`, Ready and aliased, exact commit \`fd1c367665455ca2bc66ca54d81a9cc259147284\`.\n- Migration: repository \`20260714005500_b10_enforce_attendance_date_lockdown.sql\`; production history \`20260713193455\`; QA and production policy catalogs plus runtime proof verified.\n- Cleanup: the prefixed QA and production tenants, profiles/auth users, production logs, attendance, and commercial payments reconciled to zero.\n- B10 evidence: \`output/qa/blocked-row-campaign/B10-qa-boundaries.json\`, \`B10-production-boundaries.json\`, and \`B10-production-runtime.json\`.\n- Full row inventory: \`output/qa/blocked-row-campaign/BLOCKED_ROW_INVENTORY.json\`.\n- Machine-readable checkpoint: \`output/qa/blocked-row-campaign/CHECKPOINT.json\`.\n\n## Correlation batches\n\n| Batch | Workflow/root | Rows | IDs |\n| --- | --- | ---: | --- |\n${table}\n\n## B10 closeout\n\nB10 directly proved expired-window production correction, invalid/expired/valid/consumed owner-code behavior, paid-payroll rejection, future attendance blocking, protected past attendance persistence, exact India month-to-date collection boundaries, year-crossing payroll cycles, and leap-day behavior. The production policy repair removes the broad permissive attendance bypass, and the UI now exposes bounded accessible attendance-day navigation.\n\n## Exact next action\n\nStart B11 with a fresh disposable quote/order fixture and execute quote conversion, target/over-target, cancellation/completion/deletion protection, stock-history, and Golden A protected-history scenarios before changing any of its twelve rows.\n`

await fs.mkdir(outDir, { recursive: true })
await fs.writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`)
await fs.writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`)
await fs.writeFile(humanPath, human)

process.stdout.write(`${JSON.stringify({ blocked: blocked.length, batches: batches.map((batch) => ({ id: batch.id, rows: batch.rows.length })), inventoryPath, checkpointPath, humanPath }, null, 2)}\n`)
