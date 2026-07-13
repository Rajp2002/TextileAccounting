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
const b11Rows = batches.find((batch) => batch.id === 'B11').rows
const b11Closed = b11Rows.every((id) => ledger.items.find((item) => item.id === id)?.status === 'pass')
const b12Rows = batches.find((batch) => batch.id === 'B12').rows
const b12Closed = b12Rows.every((id) => ledger.items.find((item) => item.id === id)?.status === 'pass')
const b13Rows = batches.find((batch) => batch.id === 'B13').rows
const b13Closed = b13Rows.every((id) => ledger.items.find((item) => item.id === id)?.status === 'pass')
const b14Rows = batches.find((batch) => batch.id === 'B14').rows
const b14Closed = b14Rows.every((id) => ledger.items.find((item) => item.id === id)?.status === 'pass')
const b15Rows = batches.find((batch) => batch.id === 'B15').rows
const b15PassRows = b15Rows.filter((id) => id !== 'OFF-001')
const b15ExecutableClosed = b15PassRows.every((id) => ledger.items.find((item) => item.id === id)?.status === 'pass')
    && ledger.items.find((item) => item.id === 'OFF-001')?.status === 'blocked'
const checkpoint = {
    campaign: 'blocked-row-remediation',
    updated_at: new Date().toISOString(),
    branch: 'codex/estimator-production-readiness-20260710',
    starting_counts: { pass: 270, fail: 3, blocked: 103, not_applicable: 1, total: 377 },
    current_counts: { ...counts, total: ledger.items.length },
    canonical_ledger: path.relative(root, ledgerPath),
    canonical_matrix: 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md',
    inventory: path.relative(root, inventoryPath),
    completed_batches: b15ExecutableClosed ? ['B08', 'B09', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15'] : b14Closed ? ['B08', 'B09', 'B10', 'B11', 'B12', 'B13', 'B14'] : b13Closed ? ['B08', 'B09', 'B10', 'B11', 'B12', 'B13'] : b12Closed ? ['B08', 'B09', 'B10', 'B11', 'B12'] : b11Closed ? ['B08', 'B09', 'B10', 'B11'] : b10Closed ? ['B08', 'B09', 'B10'] : b09Closed ? ['B08', 'B09'] : ['B08'],
    active_batch: b15ExecutableClosed ? 'B16' : b14Closed ? 'B15' : b13Closed ? 'B14' : b12Closed ? 'B13' : b11Closed ? 'B12' : b10Closed ? 'B11' : b09Closed ? 'B10' : 'B09',
    active_batch_state: b15ExecutableClosed ? 'B15 executable scope closed with 10 PASS, OFF-001 precisely blocked on unavailable install/standalone browser capability, matching QA/production security proof, and zero cleanup; B16 active' : b14Closed ? 'B14 closed with QA realtime/browser and exact-deployment production large-range proof plus zero cleanup; B15 active' : b13Closed ? 'B13 closed with QA runtime/browser and exact-deployment production payroll proof plus zero cleanup; B14 active' : b12Closed ? 'B12 closed with matching QA and exact-deployment production lifecycle proof plus zero cleanup; B13 active' : b11Closed ? 'B11 closed with direct QA lifecycle proof, exact production Start Party Order proof, and zero cleanup; B12 queued' : b10Closed ? 'B10 closed with QA and production proof, exact deployment, and zero cleanup; B11 queued' : b09Closed ? 'B09 closed with exact production proof and cleanup; B10 queued' : 'runtime proof complete; exact production deployment and alias proof pending',
    planned_batches: batches.map(({ id, name, rows, rootCause, validation, exit }) => ({ id, name, rows, rootCause, validation, exit })),
    rows_moved_to_pass: b15ExecutableClosed ? [...b09Rows, ...b10Rows, ...b11Rows, ...b12Rows, ...b13Rows, ...b14Rows, ...b15PassRows] : b14Closed ? [...b09Rows, ...b10Rows, ...b11Rows, ...b12Rows, ...b13Rows, ...b14Rows] : b13Closed ? [...b09Rows, ...b10Rows, ...b11Rows, ...b12Rows, ...b13Rows] : b12Closed ? [...b09Rows, ...b10Rows, ...b11Rows, ...b12Rows] : b11Closed ? [...b09Rows, ...b10Rows, ...b11Rows] : b10Closed ? [...b09Rows, ...b10Rows] : b09Closed ? b09Rows : [],
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
        ...(b11Closed ? [
            'The atomic Start Party Order server boundary existed but was not exposed in Estimator; the primary action now creates the accepted quote, active order, and yarn requirement together and routes to that order.',
            'The order lifecycle harness now proves target enforcement, completion/cancellation archival behavior, reserved stock lineage, dispatch receipts and discrepancy, independent commercial settlement, and paid-payroll correction protection.',
        ] : []),
        ...(b12Closed ? [
            'Stock-lot relational sources are now enforced at the database boundary for organization ownership and quote/order/market-run consistency, including authenticated injected-ID attempts.',
            'Market-run sales counts now include current fabric-stock sales as well as legacy direct sales, so sold-out and archived summaries remain complete.',
            'One repeatable lifecycle harness now proves market sell-out, two exact dispatch receipts, advisory compliance states, duplicate party identity, concurrent stock mutation, many-run freshness, and zero cleanup in QA and production.',
        ] : []),
        ...(b13Closed ? [
            'Payroll settlement now serializes each worker/cycle grain, rejects an already-settled race, and protects deducted or settlement-linked advances from direct deletion.',
            'Final-exit payroll and worker deactivation now commit atomically, while authorized reversal alone can restore the exact prior advance debt.',
            'Factory Today now reads the current market summary total_meters_produced field instead of the nonexistent meters_produced field.',
            'One production-backed fixture proves decimal rate snapshots, caps, adjustments, reversal, exit, Kharchi, dashboard wages, and Golden A/B payroll equations in QA and production.',
        ] : []),
        ...(b14Closed ? [
            'Dashboard actions now reject fulfilled Supabase results that contain errors instead of silently collapsing them to empty data.',
            'Worker-breakdown RPCs use the canonical submitted_at timestamp and meter-worker identity fallback in QA and production.',
            'Realtime reconnects create unique channel topics and replace authoritative dashboard slices, preventing stale-channel timeouts and double-counted totals.',
            'Order health distinguishes critical future deadlines and treats zero-production orders as at risk; dashboard loading, error, offline, empty, reconnecting, and live states are distinct and actionable.',
        ] : []),
        ...(b15ExecutableClosed ? [
            'Recovery-token lifecycle, one-hour idle enforcement, normalized proxy client keys, and cross-origin server-action rejection now have direct executable proof.',
            'Privacy export is plan-independent and responsive, while atomic owner-only worker erasure preserves payroll history and redacts retained PII and client IP audit payloads.',
            'Stored hostile markup remains inert across core owner routes, custom interactive cards are keyboard-operable, icon controls are named, and 200%-equivalent layouts retain visible actions.',
            'The PWA manifest, icons, scope, start route, update notice, and refresh activation are proven; only actual install and standalone reopen remain externally blocked.',
        ] : []),
    ] : [],
    commits: b09Closed ? [
        { sha: '812512c599b3659cc399495a674e8b3e50066e60', subject: 'fix(qa): close B09 production resilience gaps' },
        ...(b10Closed ? [
            { sha: '48d30895fde3635647b4c6c7112dd5ecc7241965', subject: 'fix(qa): enforce B10 date boundaries' },
            { sha: 'fd1c367665455ca2bc66ca54d81a9cc259147284', subject: 'fix(qa): complete B10 protected boundary proof' },
        ] : []),
        ...(b11Closed ? [
            { sha: 'dc76b17f38eb111ef3dad0a5a9f809b17168cda5', subject: 'fix(qa): expose atomic B11 party order path' },
        ] : []),
        ...(b12Closed ? [
            { sha: 'bc1e9cbfab1609adf461c405e41d6fca65b304ee', subject: 'fix(qa): harden B12 market stock lifecycle' },
        ] : []),
        ...(b13Closed ? [
            { sha: 'd42d5138fba22758f1d11218c59deb6c3ad876a3', subject: 'fix(qa): harden B13 payroll lifecycle' },
        ] : []),
        ...(b14Closed ? [
            { sha: '6f80eac94d950460bf559583dbb18ef434afde00', subject: 'fix(qa): harden B14 realtime dashboard recovery' },
        ] : []),
        ...(b15ExecutableClosed ? [
            { sha: '2e3254f75502ca56192d015c06bba4f7972518aa', subject: 'fix(security): close B15 auth privacy UX guardrails' },
        ] : []),
    ] : [],
    production_deployments: [
        { id: 'dpl_43n5khAYXGcCtp64SBowPZirjaUG', commit: '649380d5dfbcbb89d8c10cad7763448ac42c6f2c', state: 'READY' },
        ...(b09Closed ? [{ id: 'dpl_EPGVy9PMbaLLphgssXvBq9HgD5yB', commit: '812512c599b3659cc399495a674e8b3e50066e60', state: 'READY', target: 'production', alias: 'https://textile-accounting.vercel.app' }] : []),
        ...(b10Closed ? [{ id: 'dpl_5rKpnNLwszpfgfzkn8VBh291wyS6', commit: 'fd1c367665455ca2bc66ca54d81a9cc259147284', state: 'READY', target: 'production', alias: 'https://textile-accounting.vercel.app' }] : []),
        ...(b11Closed ? [{ id: 'dpl_HQbasVXv3NDZjrtVjoXjpebgtbGV', commit: 'dc76b17f38eb111ef3dad0a5a9f809b17168cda5', state: 'READY', target: 'production', alias: 'https://textile-accounting.vercel.app' }] : []),
        ...(b12Closed ? [{ id: 'dpl_q1bQa4dHd9bFKFU8ZphcVQNcE2d1', commit: 'bc1e9cbfab1609adf461c405e41d6fca65b304ee', state: 'READY', target: 'production', alias: 'https://textile-accounting.vercel.app' }] : []),
        ...(b13Closed ? [{ id: 'dpl_EBYTZG33aozbGbPLpYeAWQcF4JJD', commit: 'd42d5138fba22758f1d11218c59deb6c3ad876a3', state: 'READY', target: 'production', alias: 'https://textile-accounting.vercel.app' }] : []),
        ...(b14Closed ? [{ id: 'dpl_3Xb6mYaqnG5FRpye7ULVWcxq9ttq', commit: '6f80eac94d950460bf559583dbb18ef434afde00', state: 'READY', target: 'production', alias: 'https://textile-accounting.vercel.app' }] : []),
        ...(b15ExecutableClosed ? [{ id: 'dpl_CmFozomMsAhE36kvGUMQiPwJpsFr', commit: '2e3254f75502ca56192d015c06bba4f7972518aa', state: 'READY', target: 'production', alias: 'https://textile-accounting.vercel.app' }] : []),
    ],
    migrations: [
        { environment: 'production', head: '20260713124500', alignment: 'verified' },
        ...(b10Closed ? [{ environment: 'qa and production', file: '20260714005500_b10_enforce_attendance_date_lockdown.sql', production_history_version: '20260713193455', alignment: 'verified by policy catalog and runtime proof' }] : []),
        ...(b11Closed ? [{ environment: 'production', file: '20260702131500_batch_23_start_party_order_transaction_boundary.sql', alignment: 'verified deployed and exercised by production UI plus persisted linkage proof' }] : []),
        ...(b12Closed ? [
            { environment: 'qa and production', file: '20260714033000_b12_enforce_stock_source_integrity.sql', production_history_version: '20260713211109', alignment: 'verified by trigger catalog and injected relational-source runtime probes' },
            { environment: 'qa and production', file: '20260714034500_b12_include_stock_sales_in_market_summary.sql', production_history_version: '20260713211113', alignment: 'verified by view catalog and sold-out/current-sale runtime summaries' },
        ] : []),
        ...(b13Closed ? [
            { environment: 'qa and production', file: '20260714043000_b13_harden_payroll_settlement_lifecycle.sql', production_history_version: '20260713214539', alignment: 'verified by function/trigger catalog plus authenticated QA and production runtime proof' },
        ] : []),
        ...(b14Closed ? [
            { environment: 'qa and production', file: '20260714053000_b14_repair_worker_breakdown_timestamp.sql', production_history_version: '20260713222345', alignment: 'verified by function catalog plus QA browser/runtime and production large-range proof; existing production rows were not rewritten' },
        ] : []),
        ...(b15ExecutableClosed ? [
            { environment: 'qa and production', file: '20260714063000_b15_atomic_worker_erasure.sql', production_history_version: '20260713232352', alignment: 'verified by function catalog plus authenticated QA browser/runtime and disposable production erasure proof; retained history preserved with PII and client IP redacted' },
            { environment: 'qa and production', file: '20260714064500_b15_scope_production_log_triggers.sql', production_history_version: '20260713232354', alignment: 'verified by trigger catalog and erasure runtime proof; privacy-only history updates no longer rerun production business-boundary triggers' },
        ] : []),
    ],
    created_test_accounts_and_tenants: [
        { batch: 'B09', type: 'prefixed disposable production tenant with three auth users', state: b09Closed ? 'removed; organizations/profiles/machines/logs/auth all reconciled to zero' : 'active until exact production proof and cleanup' },
        ...(b10Closed ? [{ batch: 'B10', type: 'prefixed disposable QA and production tenants with owner and supervisor proof users', state: 'removed; organizations/profiles/production logs/attendance/commercial payments/auth all reconciled to zero' }] : []),
        ...(b11Closed ? [{ batch: 'B11', type: 'prefixed disposable QA lifecycle tenant and production Estimator tenant', state: 'removed; organizations/profiles/auth and scoped quote/order/yarn/production/stock/dispatch/commercial/payroll rows reconciled' }] : []),
        ...(b12Closed ? [{ batch: 'B12', type: 'prefixed disposable QA and production market-stock tenants with owner/adversary auth users', state: 'removed; organizations/profiles/auth/stock lots and all market/production/sale/dispatch/receipt/commercial dependencies reconciled to zero' }] : []),
        ...(b13Closed ? [{ batch: 'B13', type: 'prefixed disposable QA and production payroll tenants with owner/supervisor auth users', state: 'removed; organizations/profiles/auth/settlements/advances/production/payroll and all dependent rows reconciled to zero' }] : []),
        ...(b14Closed ? [{ batch: 'B14', type: 'prefixed disposable QA and production dashboard tenants with owner auth users', state: 'removed; organizations/profiles/auth/1,800-log production fixtures and all dashboard dependencies reconciled to zero in both environments' }] : []),
        ...(b15ExecutableClosed ? [{ batch: 'B15', type: 'prefixed disposable QA and production security tenants with owner/adversary/recovery auth users', state: 'removed; organizations/profiles/auth/workers/production/audit/export and all dependent fixtures reconciled to zero in both environments' }] : []),
    ],
    outstanding_external_dependencies: batches.filter((batch) => ['B16', 'B17', 'B18', 'B19'].includes(batch.id)).map((batch) => ({ batch: batch.id, rows: batch.rows, dependency: batch.rootCause })),
    last_successful_validation: b15ExecutableClosed
        ? 'B15 production deployment dpl_CmFozomMsAhE36kvGUMQiPwJpsFr Ready at exact commit 2e3254f; local and remote gates passed 89 files / 633 passed plus 1 intentional skip; QA browser/HTTP/database proof and production 10-assertion security proof passed; cleanup reconciled to zero. OFF-001 remains blocked only on actual install and standalone reopen.'
        : b14Closed
        ? 'B14 production deployment dpl_3Xb6mYaqnG5FRpye7ULVWcxq9ttq Ready at exact commit 6f80eac; local and remote gates passed 88 files / 625 passed plus 1 intentional skip; QA realtime/browser proof and production 1,800-log range proof passed; cleanup reconciled to zero.'
        : b13Closed
        ? 'B13 production deployment dpl_EBYTZG33aozbGbPLpYeAWQcF4JJD Ready at exact commit d42d513; local and remote gates passed 87 files / 621 tests; QA runtime and browser proof plus production runtime passed all payroll lifecycle assertions; cleanup reconciled to zero.'
        : b12Closed
        ? 'B12 production deployment dpl_q1bQa4dHd9bFKFU8ZphcVQNcE2d1 Ready at exact commit bc1e9cb; local and remote gates passed 86 files / 617 tests; QA and production each passed 17 market/stock/dispatch/commercial assertions; the final 26-run production summary loaded in 25.3 ms; cleanup reconciled to zero.'
        : b11Closed
        ? 'B11 production deployment dpl_HQbasVXv3NDZjrtVjoXjpebgtbGV Ready at exact commit dc76b17; local and remote gates passed 85 files / 611 tests with 1 intentional skip; production Estimator created and opened a backlinked quote/order/yarn chain; QA lifecycle passed 34 assertions; cleanup reconciled to zero.'
        : b10Closed
        ? 'B10 production deployment dpl_5rKpnNLwszpfgfzkn8VBh291wyS6 Ready at exact commit fd1c367; remote gate 85 files / 611 tests; production correction/access-code/settlement, attendance, India-month, calendar, policy-catalog, persistence, and zero-fixture cleanup all passed.'
        : b09Closed
        ? 'B09 production deployment dpl_EPGVy9PMbaLLphgssXvBq9HgD5yB Ready at exact commit 812512c; remote gate 82 files / 599 tests; production alias Copy previous, accessible sheet, verified breakdown persistence, migration head, and zero-fixture cleanup all passed.'
        : 'B09 optimized production build; 82 files / 598 passed and 1 skipped; 20-loom browser, offline, timeout, invalid-payload, breakdown persistence, and two-supervisor concurrency proof all green.',
    exact_next_action: b15ExecutableClosed
        ? 'Execute B16 in the deterministic WhatsApp provider simulator: consent, success, skipped, timeout, retry, cooldown, failure, and token/rejection boundaries while proving core advances, payroll, and access-code writes remain correct.'
        : b14Closed
        ? 'Start B15 with isolated QA accounts and execute recovery-token lifecycle, timed session expiry, proxy-isolated rate limiting, export/audit/privacy erasure, adversarial input, keyboard/zoom, and installable PWA proof.'
        : b13Closed
        ? 'Start B14 by auditing realtime subscription/refetch behavior, disconnect/reconnect recovery, independent pace calculations, large-range timing, and distinct empty/loading/error/offline dashboard states.'
        : b12Closed
        ? 'Execute B13 with one isolated payroll fixture covering decimal operator rates, historical snapshots, advance caps and adjustments, concurrent settlement, reversal, exit/final mode, kharchi atomicity, dashboard wages, and Golden A/B payroll steps.'
        : b11Closed
        ? 'Start B12 by auditing the market-run, stock-sale, dispatch-receipt, compliance-warning, concurrency, and party-identity paths; build one isolated QA fixture that proves all ten rows before any promotion.'
        : b10Closed
        ? 'Start B11 with a fresh disposable quote/order fixture and execute quote conversion, target/over-target, cancellation/completion/deletion protection, stock-history, and Golden A protected-history scenarios before changing any of its twelve rows.'
        : b09Closed
        ? 'Start B10 with a fresh disposable fixture: execute historical correction windows, access-code consumption/expiry, settled-period protection, and India calendar boundaries before changing any of its eight rows.'
        : 'Commit and push the B09 implementation/evidence, deploy that exact commit to production, re-run the affected production alias paths, then promote only the 17 proven B09 rows.',
}

const table = batches.map((batch) => `| ${batch.id} | ${batch.name} | ${batch.rows.length} | ${batch.rows.map((id) => `\`${id}\``).join(', ')} |`).join('\n')
const human = `# Blocked-Row Remediation Checkpoint\n\n- Canonical baseline: 270 PASS, 3 FAIL, 103 BLOCKED, 1 NOT APPLICABLE (377 total).\n- Current ledger: **${counts.pass} PASS, ${counts.fail} FAIL, ${counts.blocked} BLOCKED, ${counts.not_applicable} NOT APPLICABLE (${ledger.items.length} total)**.\n- Canonical ledger: \`output/qa/PILOTQA-20260621-2058-8QIH/results.json\`.\n- Completed batch: **${b15ExecutableClosed ? 'B15 — authentication, privacy, audit, adversarial UX, and PWA device proof (10 PASS, 1 precisely BLOCKED)' : 'B14 — realtime dashboard recovery and large-range states (5/5 PASS)'}**.\n- Active batch: **${b15ExecutableClosed ? 'B16 — WhatsApp simulation and provider boundaries' : 'B15 — authentication, privacy, audit, adversarial UX, and PWA device proof'}**.\n- Validation gate: local and Vercel gates passed 89 files / 633 passed plus 1 intentional skip, TypeScript, targeted lint, and a successful optimized Next.js build.\n- Production deployment: \`${b15ExecutableClosed ? 'dpl_CmFozomMsAhE36kvGUMQiPwJpsFr' : 'dpl_3Xb6mYaqnG5FRpye7ULVWcxq9ttq'}\`, Ready and aliased, exact commit \`${b15ExecutableClosed ? '2e3254f75502ca56192d015c06bba4f7972518aa' : '6f80eac94d950460bf559583dbb18ef434afde00'}\`.\n- Migrations: B15 atomic worker erasure and production-trigger scoping are deployed and exercised in QA and production; retained production/payroll history remains intact while worker PII and client IP audit payloads are redacted.\n- Cleanup: all prefixed B15 QA and production tenants, profiles/auth users, worker/production/audit/export fixtures, and dependencies were removed and reconciled.\n- B15 evidence: \`output/qa/blocked-row-campaign/B15-qa-security.json\`, \`B15-qa-browser.json\`, \`B15-qa-http.json\`, and \`B15-production-security.json\`.\n- OFF-001 blocker: actual install and standalone reopen need a supported PWA-capable browser/device; manifest, icons, scope, start route, update notice, and refresh activation are already proven.\n- Full row inventory: \`output/qa/blocked-row-campaign/BLOCKED_ROW_INVENTORY.json\`.\n- Machine-readable checkpoint: \`output/qa/blocked-row-campaign/CHECKPOINT.json\`.\n\n## Correlation batches\n\n| Batch | Workflow/root | Rows | IDs |\n| --- | --- | ---: | --- |\n${table}\n\n## B15 closeout\n\nB15 directly proved the recovery-token lifecycle, one-hour idle expiry, proxy-isolated auth limiter keys, same-user/cross-origin action rejection, tenant-scoped audited export, atomic erasure with retained-history redaction, stored-XSS safety, audit context, keyboard operation, and 200%-equivalent layouts. The exact implementation commit and both migrations are live, matching disposable QA and production fixtures passed and reconciled to zero, and only OFF-001 install/standalone reopen remains blocked by browser capability.\n\n## Exact next action\n\n${b15ExecutableClosed ? 'Execute B16 with a deterministic WhatsApp provider simulator covering consent, sent/skipped/timeout/retry/cooldown/failure outcomes and core-write invariants before any WA row promotion.' : 'Complete B15 executable proof and preserve OFF-001 as blocked unless actual install/standalone reopen is observed.'}\n`

await fs.mkdir(outDir, { recursive: true })
await fs.writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`)
await fs.writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`)
await fs.writeFile(humanPath, human)

process.stdout.write(`${JSON.stringify({ blocked: blocked.length, batches: batches.map((batch) => ({ id: batch.id, rows: batch.rows.length })), inventoryPath, checkpointPath, humanPath }, null, 2)}\n`)
