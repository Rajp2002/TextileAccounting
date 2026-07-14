#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const workspace = process.cwd()
const TARGET_METERS = 235.75
const INITIAL_LOGS = [120.5, 110.25]
const CORRECTED_LOGS = [125.5, 110.25]
const WORKER_RATE = 2.5
const STOCK_METERS_PER_UNIT = 50
const SOLD_METERS = 120
const SALE_RATE = 60
const DISPATCH_1_METERS = 70
const DISPATCH_2_METERS = 50
const DISPATCH_2_RECEIVED = 45
const PARTIAL_PAYMENT = 2200
const FINAL_PAYMENT = 5000
const TOTAL_RECEIVABLE = SOLD_METERS * SALE_RATE

const closureTargets = [
    'QUOTE-007',
    'ORDER-005',
    'ORDER-007',
    'ORDER-009',
    'ORDER-010',
    'ORDER-011',
    'ORDER-012',
    'ORDER-013',
    'ORDER-014',
    'ORDER-015',
    'STOCK-011',
    'GOLDEN-A-23',
]

const outOfScopeRows = [
    'GOLDEN-A-21',
    'GOLDEN-A-22',
    'SIGNOFF-10',
    'TIME-002',
    'OFF-009',
    'SIGNOFF-01',
    'SIGNOFF-02',
    'SIGNOFF-04',
    'TECH-011',
    'TECH-012',
]

function parseEnv(contents) {
    const result = {}
    for (const rawLine of contents.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
        if (!match) continue
        let value = match[2].trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
        }
        result[match[1]] = value
    }
    return result
}

async function readEnv() {
    const env = { ...process.env }
    for (const relative of ['.env.local', 'supabase/.env.local']) {
        try {
            Object.assign(env, parseEnv(await fs.readFile(path.join(workspace, relative), 'utf8')))
        } catch (error) {
            if (error.code !== 'ENOENT') throw error
        }
    }
    return env
}

function todayDate() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date())

    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    return `${byType.year}-${byType.month}-${byType.day}`
}

function addDays(dateString, days) {
    const date = new Date(`${dateString}T00:00:00.000Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
}

function safeId(value) {
    return typeof value === 'string' ? `${value.slice(0, 8)}...${value.slice(-4)}` : null
}

function runTimestamp() {
    return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
}

function numberValue(value) {
    if (value === null || value === undefined) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

function round2(value) {
    return Math.round(numberValue(value) * 100) / 100
}

function near(actual, expected, tolerance = 0.01) {
    const parsed = numberValue(actual)
    return parsed !== null && Math.abs(parsed - expected) <= tolerance
}

function rowFromRpc(data) {
    return Array.isArray(data) ? data[0] : data
}

function assertCondition(assertions, name, passed, details = {}) {
    assertions.push({ name, passed, ...details })
    if (!passed) {
        throw new Error(`${name} failed: ${JSON.stringify(details)}`)
    }
}

function clientFor(url, anonKey) {
    return createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
}

async function signIn(url, anonKey, email, password, label) {
    const client = clientFor(url, anonKey)
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error || !data.user) throw new Error(`failed to sign in ${label}: ${error?.message}`)
    return client
}

async function createDisposableTenant(admin, anon) {
    const suffix = crypto.randomBytes(5).toString('hex')
    const ownerEmail = `batch6-golden-owner-${suffix}@qa.weavly.local`
    const supervisorEmail = `batch6-golden-supervisor-${suffix}@qa.weavly.local`
    const ownerPassword = `B6-owner-${suffix}-${crypto.randomBytes(8).toString('hex')}!`
    const supervisorPassword = `B6-supervisor-${suffix}-${crypto.randomBytes(8).toString('hex')}!`

    const ownerUser = await admin.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
        user_metadata: { full_name: 'Batch 6 Golden Owner' },
    })
    if (ownerUser.error || !ownerUser.data.user) {
        throw new Error(`failed to create disposable owner: ${ownerUser.error?.message}`)
    }

    const supervisorUser = await admin.auth.admin.createUser({
        email: supervisorEmail,
        password: supervisorPassword,
        email_confirm: true,
        user_metadata: { full_name: 'Batch 6 Golden Supervisor' },
    })
    if (supervisorUser.error || !supervisorUser.data.user) {
        throw new Error(`failed to create disposable supervisor: ${supervisorUser.error?.message}`)
    }

    const joinCode = `B6${suffix.slice(0, 6).toUpperCase()}`
    const { data: org, error: orgError } = await admin
        .from('organizations')
        .insert({
            name: `Batch 6 Golden ${suffix}`,
            owner_id: ownerUser.data.user.id,
            join_code: joinCode,
            join_code_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            onboarding_complete: true,
            production_mode: 'both',
        })
        .select('id')
        .single()
    if (orgError || !org) throw new Error(`failed to create disposable org: ${orgError?.message}`)

    const { error: profileError } = await admin
        .from('profiles')
        .insert([
            {
                id: ownerUser.data.user.id,
                org_id: org.id,
                role: 'owner',
                full_name: 'Batch 6 Golden Owner',
                email: ownerEmail,
            },
            {
                id: supervisorUser.data.user.id,
                org_id: org.id,
                role: 'supervisor',
                full_name: 'Batch 6 Golden Supervisor',
                email: supervisorEmail,
            },
        ])
    if (profileError) throw new Error(`failed to create disposable profiles: ${profileError.message}`)

    const { error: subscriptionError } = await admin
        .from('org_subscriptions')
        .insert({
            org_id: org.id,
            plan_id: 'trial',
            plan_tier: 'premium',
            status: 'active',
            current_end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
    if (subscriptionError) throw new Error(`failed to create disposable subscription: ${subscriptionError.message}`)

    return {
        orgId: org.id,
        ownerUserId: ownerUser.data.user.id,
        supervisorUserId: supervisorUser.data.user.id,
        ownerEmail,
        supervisorEmail,
        ownerClient: await signIn(anon.url, anon.key, ownerEmail, ownerPassword, 'owner'),
        ownerSecondClient: await signIn(anon.url, anon.key, ownerEmail, ownerPassword, 'second owner session'),
        supervisorClient: await signIn(anon.url, anon.key, supervisorEmail, supervisorPassword, 'supervisor'),
    }
}

async function cleanupDisposable(admin, resource, options = {}) {
    if (!resource) return []

    const errors = []
    const deleteByOrg = [
        'commercial_payment_receipts',
        'commercial_receivables',
        'party_dispatch_claims',
        'dispatch_package_lines',
        'fabric_packages',
        'stock_discrepancies',
        'dispatches',
        'fabric_stock_movements',
        'fabric_stock_sales',
        'fabric_stock_inward_drafts',
        'fabric_stock_lots',
        'payroll_settlements',
        'production_logs',
        'machine_assignments',
        'machines',
        'workers',
        'order_yarn_requirements',
        'orders',
        'estimator_quotes',
        'org_subscriptions',
        'parties',
        'qualities',
        'audit_log',
    ]

    for (const table of deleteByOrg) {
        try {
            const { error } = await admin.from(table).delete().eq('org_id', resource.orgId)
            if (error) errors.push(`${table}: ${error.message}`)
        } catch (error) {
            errors.push(`${table}: ${String(error.message || error)}`)
        }
    }

    try {
        const { error } = await admin.from('profiles').delete().in('id', [resource.ownerUserId, resource.supervisorUserId])
        if (error) errors.push(`profiles: ${error.message}`)
    } catch (error) {
        errors.push(`profiles: ${String(error.message || error)}`)
    }

    try {
        const { error } = await admin.from('organizations').delete().eq('id', resource.orgId)
        if (error) errors.push(`organizations: ${error.message}`)
    } catch (error) {
        errors.push(`organizations: ${String(error.message || error)}`)
    }

    for (const [label, userId] of [
        ['owner auth user', resource.ownerUserId],
        ['supervisor auth user', resource.supervisorUserId],
    ]) {
        try {
            const { error } = await admin.auth.admin.deleteUser(userId)
            if (error) errors.push(`${label}: ${error.message}`)
        } catch (error) {
            errors.push(`${label}: ${String(error.message || error)}`)
        }
    }

    if (options.throwOnError && errors.length > 0) {
        throw new Error(`disposable cleanup failed: ${errors.join('; ')}`)
    }

    return errors
}

async function seedGoldenASetup(owner, orgId) {
    const today = todayDate()
    const { data: authData, error: authError } = await owner.auth.getUser()
    if (authError || !authData.user) throw new Error(`failed to resolve disposable owner: ${authError?.message}`)
    const ageEvidence = (reference) => ({
        date_of_birth: '1990-01-01',
        age_verification_method: 'government_id',
        age_verification_reference: `batch6-${reference}-${crypto.randomUUID()}`,
        age_verified_at: new Date().toISOString(),
        age_verified_by: authData.user.id,
    })
    const { data: quality, error: qualityError } = await owner
        .from('qualities')
        .insert({
            org_id: orgId,
            name: 'Batch 6 Golden Fabric',
            target_yield: 0,
            avg_sale_price_per_m: SALE_RATE,
            theoretical_meters_per_day: TARGET_METERS,
            default_worker_rate_per_m: WORKER_RATE,
        })
        .select('id')
        .single()
    if (qualityError || !quality) throw new Error(`failed to create quality: ${qualityError?.message}`)

    const trackingToken = `B6-${crypto.randomUUID()}`
    const { data: startRows, error: startError } = await owner.rpc('start_party_order_from_estimator', {
        p_party_name: 'Batch 6 Golden Buyer',
        p_quality_label: 'Batch 6 Golden Fabric',
        p_warp_instruction: 'Batch 6 Golden warp',
        p_weft_instruction: 'Batch 6 Golden weft',
        p_order_quantity_m: TARGET_METERS,
        p_landed_cost_per_meter: 40,
        p_quote_price_per_meter: SALE_RATE,
        p_worker_rate_per_m: WORKER_RATE,
        p_target_meters: TARGET_METERS,
        p_deadline: addDays(today, 7),
        p_notes: 'Batch 6 disposable Golden A runtime proof',
        p_tracking_token: trackingToken,
        p_warp_required_kg: 20,
        p_weft_required_kg: 10,
        p_total_required_kg: 30,
        p_estimated_beams: 1,
        p_requirement_snapshot: { order_quantity_m: TARGET_METERS },
    })
    if (startError) throw new Error(`failed to start party order atomically: ${startError.message}`)
    const started = rowFromRpc(startRows)
    if (!started?.success || !started.order_id || !started.quote_id) {
        throw new Error(`failed to start party order atomically: ${started?.error ?? 'missing linked ids'}`)
    }

    const { data: order, error: orderError } = await owner
        .from('orders')
        .update({
            quality_id: quality.id,
            party_phone: '9000000006',
            stock_meters_per_unit: STOCK_METERS_PER_UNIT,
            stock_unit_label: 'taka',
            default_godown: 'Batch 6 QA Godown',
            dispatch_batch_meters: DISPATCH_1_METERS,
        })
        .eq('org_id', orgId)
        .eq('id', started.order_id)
        .select('id, quote_id, tracking_token')
        .single()
    if (orderError || !order) throw new Error(`failed to finish atomic order fixture: ${orderError?.message}`)

    const { data: workers, error: workersError } = await owner
        .from('workers')
        .insert([
            { org_id: orgId, name: 'Batch 6 Golden Day Worker', is_active: true, ...ageEvidence('day') },
            { org_id: orgId, name: 'Batch 6 Golden Night Worker', is_active: true, ...ageEvidence('night') },
        ])
        .select('id, name')
    if (workersError || !workers || workers.length !== 2) {
        throw new Error(`failed to create workers: ${workersError?.message}`)
    }

    const { data: machines, error: machinesError } = await owner
        .from('machines')
        .insert([
            { org_id: orgId, name: 'Batch 6 Golden Loom 1', status: 'inactive', loom_type: 'rapier' },
            { org_id: orgId, name: 'Batch 6 Golden Loom 2', status: 'inactive', loom_type: 'rapier' },
        ])
        .select('id, name')
    if (machinesError || !machines || machines.length !== 2) {
        throw new Error(`failed to create machines: ${machinesError?.message}`)
    }

    const assignmentRows = machines.flatMap((machine) => [
        { org_id: orgId, machine_id: machine.id, worker_id: workers[0].id, shift: 'day' },
        { org_id: orgId, machine_id: machine.id, worker_id: workers[1].id, shift: 'night' },
    ])
    const { error: assignmentError } = await owner.from('machine_assignments').insert(assignmentRows)
    if (assignmentError) throw new Error(`failed to create machine assignments: ${assignmentError.message}`)

    const { error: activateError } = await owner
        .from('machines')
        .update({ current_order_id: order.id, status: 'active' })
        .eq('org_id', orgId)
        .in('id', machines.map((machine) => machine.id))
    if (activateError) throw new Error(`failed to activate machines: ${activateError.message}`)

    return {
        today,
        qualityId: quality.id,
        orderId: order.id,
        quoteId: started.quote_id,
        trackingToken: order.tracking_token,
        workerIds: workers.map((worker) => worker.id),
        machineIds: machines.map((machine) => machine.id),
    }
}

function productionPayload(setup, metersByMachine) {
    return setup.machineIds.map((machineId, index) => ({
        machine_id: machineId,
        worker_id: setup.workerIds[0],
        order_id: setup.orderId,
        meters: metersByMachine[index],
        opening_meter_reading: 0,
        closing_meter_reading: metersByMachine[index],
        counter_was_reset: false,
        shift: 'day',
        date: setup.today,
        worker_rate_snapshot: WORKER_RATE,
        submitted_at: new Date().toISOString(),
        client_ip: 'batch6-runtime-proof',
    }))
}

async function replaceProduction(supervisor, setup, allowOverwrite) {
    const meters = allowOverwrite ? CORRECTED_LOGS : INITIAL_LOGS
    const { data, error } = await supervisor.rpc('replace_shift_production_logs', {
        p_logs: productionPayload(setup, meters),
        p_allow_overwrite: allowOverwrite,
        p_access_code_used: false,
    })
    if (error) throw new Error(`replace_shift_production_logs failed: ${error.message}`)
    return rowFromRpc(data)
}

async function productionSnapshot(owner, orgId, setup) {
    const [logsResult, progressResult, lotsResult, draftsResult, movementsResult] = await Promise.all([
        owner
            .from('production_logs')
            .select('id, meters, worker_rate_snapshot, order_id, date, shift')
            .eq('org_id', orgId)
            .eq('order_id', setup.orderId)
            .eq('date', setup.today)
            .eq('shift', 'day'),
        owner
            .from('order_progress_summary')
            .select('order_id, status, total_meters_produced, progress_percent, assigned_machines_count')
            .eq('org_id', orgId)
            .eq('order_id', setup.orderId)
            .single(),
        owner
            .from('fabric_stock_lot_summary')
            .select('stock_lot_id, order_id, source_type, stock_purpose, original_meters, available_meters, original_taka_count, available_taka_count, sold_meters, quality_label, source_date, source_shift')
            .eq('org_id', orgId)
            .eq('order_id', setup.orderId)
            .eq('source_date', setup.today)
            .eq('source_shift', 'day'),
        owner
            .from('fabric_stock_inward_drafts')
            .select('id, suggested_meters, status, confirmed_stock_lot_id')
            .eq('org_id', orgId)
            .eq('order_id', setup.orderId)
            .eq('source_date', setup.today)
            .eq('source_shift', 'day'),
        owner
            .from('fabric_stock_movements')
            .select('id, movement_type, meters_delta, reference, notes')
            .eq('org_id', orgId)
            .eq('movement_date', setup.today)
            .order('created_at', { ascending: true }),
    ])

    const error = logsResult.error || progressResult.error || lotsResult.error || draftsResult.error || movementsResult.error
    if (error) throw new Error(`production snapshot failed: ${error.message}`)

    const totalMeters = round2((logsResult.data ?? []).reduce((sum, row) => sum + Number(row.meters ?? 0), 0))
    return {
        log_count: logsResult.data?.length ?? 0,
        production_meters: totalMeters,
        order_progress: progressResult.data,
        lots: lotsResult.data ?? [],
        drafts: draftsResult.data ?? [],
        movements: movementsResult.data ?? [],
    }
}

async function createSaleOnly(owner, setup) {
    const stockLotId = setup.stockLotId
    const { data, error } = await owner.rpc('create_party_stock_sale_dispatch_v1', {
        p_source_type: 'stock_lot',
        p_source_id: stockLotId,
        p_party_name: 'Batch 6 Golden Buyer',
        p_party_phone: '9000000006',
        p_party_city: 'Surat',
        p_party_gstin: null,
        p_sold_meters: SOLD_METERS,
        p_sold_takas: null,
        p_sale_rate_per_meter: SALE_RATE,
        p_credit_days: 7,
        p_sale_date: setup.today,
        p_dispatch_now: false,
        p_actual_dispatched_meters: null,
        p_dispatch_date: null,
        p_transport_name: null,
        p_vehicle_number: null,
        p_challan_number: null,
        p_notes: 'Batch 6 Golden sale-only proof',
        p_party_id: null,
        p_idempotency_key: `batch6-golden-sale:${crypto.randomUUID()}`,
    })
    if (error) throw new Error(`create_party_stock_sale_dispatch_v1 failed: ${error.message}`)
    return rowFromRpc(data)
}

async function saleSnapshot(owner, orgId, saleId) {
    const [saleResult, receivableResult, movementResult] = await Promise.all([
        owner
            .from('fabric_stock_sales')
            .select('id, stock_lot_id, party_id, party_name, meters_sold, taka_sold, revenue_amount, dispatch_status, dispatched_meters, pending_dispatch_meters, dispatch_id')
            .eq('org_id', orgId)
            .eq('id', saleId)
            .single(),
        owner
            .from('commercial_receivables')
            .select('id, source_type, source_id, order_id, dispatch_id, party_id, party_name, quality_label, total_amount, received_amount, balance_amount, payment_status, credit_days, due_date')
            .eq('org_id', orgId)
            .eq('source_type', 'fabric_stock_sale')
            .eq('source_id', saleId),
        owner
            .from('fabric_stock_movements')
            .select('id, movement_type, meters_delta, sale_id')
            .eq('org_id', orgId)
            .eq('sale_id', saleId)
            .eq('movement_type', 'sale'),
    ])
    const error = saleResult.error || receivableResult.error || movementResult.error
    if (error) throw new Error(`sale snapshot failed: ${error.message}`)
    return {
        sale: saleResult.data,
        receivables: receivableResult.data ?? [],
        sale_movements: movementResult.data ?? [],
    }
}

async function createOrderDispatch(owner, resource, setup, saleId, meters, dispatchIndex) {
    const { data, error } = await owner.rpc('create_stock_sale_dispatch', {
        p_org_id: resource.orgId,
        p_order_id: setup.orderId,
        p_sale_ids: [saleId],
        p_dispatch_meters: [meters],
        p_dispatch_takas: [1],
        p_dispatch_date: setup.today,
        p_notes: `Batch 6 Golden dispatch ${dispatchIndex}`,
        p_eway_bill_number: null,
        p_vehicle_number: null,
        p_transporter_name: 'Batch 6 QA Transport',
        p_transporter_id: null,
        p_approximate_distance_km: null,
        p_eway_bill_generated_at: null,
        p_created_by: resource.ownerUserId,
        p_idempotency_key: `batch6-golden-dispatch-${dispatchIndex}:${crypto.randomUUID()}`,
    })
    if (error) throw new Error(`create_stock_sale_dispatch ${dispatchIndex} failed: ${error.message}`)
    return rowFromRpc(data)
}

async function dispatchSnapshot(owner, orgId, orderId, saleId) {
    const [dispatchResult, lineResult, saleResult] = await Promise.all([
        owner
            .from('dispatches')
            .select('id, order_id, stock_sale_id, dispatch_number, qty_meters_sent, qty_meters_received, received_meters, receipt_status, status, receipt_confirmed_by_owner')
            .eq('org_id', orgId)
            .eq('order_id', orderId)
            .order('dispatch_number', { ascending: true }),
        owner
            .from('dispatch_package_lines')
            .select('id, dispatch_id, package_id, qty_meters_sent, qty_meters_received')
            .eq('org_id', orgId)
            .eq('order_id', orderId),
        owner
            .from('fabric_stock_sales')
            .select('id, dispatch_status, dispatched_meters, pending_dispatch_meters, dispatch_id')
            .eq('org_id', orgId)
            .eq('id', saleId)
            .single(),
    ])
    const error = dispatchResult.error || lineResult.error || saleResult.error
    if (error) throw new Error(`dispatch snapshot failed: ${error.message}`)
    return {
        dispatches: dispatchResult.data ?? [],
        package_lines: lineResult.data ?? [],
        sale: saleResult.data,
    }
}

async function confirmReceipt(owner, resource, setup, dispatchId, sentMeters, receivedMeters, note) {
    const { data, error } = await owner.rpc('confirm_fabric_dispatch_receipt', {
        p_dispatch_id: dispatchId,
        p_tracking_token: setup.trackingToken,
        p_qty_received: receivedMeters,
    })
    if (error) throw new Error(`confirm_fabric_dispatch_receipt failed: ${error.message}`)

    const receiptStatus = near(sentMeters, receivedMeters) ? 'matched' : 'difference_reported'
    const { error: updateError } = await owner
        .from('dispatches')
        .update({
            receipt_confirmed_by_owner: true,
            receipt_confirmation_note: note,
            receipt_confirmed_by: resource.ownerUserId,
            received_meters: receivedMeters,
            received_note: note,
            receipt_status: receiptStatus,
        })
        .eq('org_id', resource.orgId)
        .eq('id', dispatchId)
    if (updateError) throw new Error(`owner receipt confirmation update failed: ${updateError.message}`)

    return rowFromRpc(data)
}

async function receiptSnapshot(owner, orgId, dispatchId) {
    const [dispatchResult, discrepancyResult, claimResult, lineResult] = await Promise.all([
        owner
            .from('dispatches')
            .select('id, status, qty_meters_sent, qty_meters_received, received_meters, receipt_status, receipt_confirmed_by_owner, receipt_confirmation_note')
            .eq('org_id', orgId)
            .eq('id', dispatchId)
            .single(),
        owner
            .from('stock_discrepancies')
            .select('id, expected_meters, actual_dispatched_meters, actual_received_meters, difference_meters, discrepancy_type, status, source_reference')
            .eq('org_id', orgId)
            .eq('dispatch_id', dispatchId),
        owner
            .from('party_dispatch_claims')
            .select('id, claim_type, claim_status, shortage_meters')
            .eq('org_id', orgId)
            .eq('dispatch_id', dispatchId),
        owner
            .from('dispatch_package_lines')
            .select('id, qty_meters_sent, qty_meters_received')
            .eq('org_id', orgId)
            .eq('dispatch_id', dispatchId),
    ])
    const error = dispatchResult.error || discrepancyResult.error || claimResult.error || lineResult.error
    if (error) throw new Error(`receipt snapshot failed: ${error.message}`)
    return {
        dispatch: dispatchResult.data,
        discrepancies: discrepancyResult.data ?? [],
        claims: claimResult.data ?? [],
        package_lines: lineResult.data ?? [],
    }
}

async function recordPayment(owner, receivableId, amount, mode, setup, label) {
    const { error } = await owner.rpc('record_commercial_payment_v1', {
        p_receivable_id: receivableId,
        p_amount: amount,
        p_payment_date: setup.today,
        p_payment_mode: mode,
        p_reference_number: `B6-${label}`,
        p_cheque_number: null,
        p_cheque_date: null,
        p_bank_name: mode === 'bank' ? 'Batch 6 QA Bank' : null,
        p_notes: `Batch 6 Golden ${label} payment`,
        p_idempotency_key: `batch6-golden-payment-${label}:${crypto.randomUUID()}`,
    })
    if (error) throw new Error(`record_commercial_payment_v1 ${label} failed: ${error.message}`)
}

async function paymentSnapshot(owner, orgId, receivableId) {
    const [receivableResult, receiptsResult] = await Promise.all([
        owner
            .from('commercial_receivables')
            .select('id, total_amount, received_amount, balance_amount, payment_status')
            .eq('org_id', orgId)
            .eq('id', receivableId)
            .single(),
        owner
            .from('commercial_payment_receipts')
            .select('id, amount, payment_mode, reference_number, payment_date')
            .eq('org_id', orgId)
            .eq('receivable_id', receivableId)
            .order('created_at', { ascending: true }),
    ])
    const error = receivableResult.error || receiptsResult.error
    if (error) throw new Error(`payment snapshot failed: ${error.message}`)
    return {
        receivable: receivableResult.data,
        receipts: receiptsResult.data ?? [],
    }
}

async function goldenSnapshot(owner, orgId, setup, saleId, receivableId) {
    const [progressResult, lotResult, saleResult, dispatchResult, receivableResult, receiptsResult, discrepancyResult, claimResult, pendingDispatchResult, inTransitResult] = await Promise.all([
        owner
            .from('order_progress_summary')
            .select('order_id, status, total_meters_produced, progress_percent, assigned_machines_count')
            .eq('org_id', orgId)
            .eq('order_id', setup.orderId)
            .single(),
        owner
            .from('fabric_stock_lot_summary')
            .select('stock_lot_id, original_meters, available_meters, sold_meters')
            .eq('org_id', orgId)
            .eq('stock_lot_id', setup.stockLotId)
            .single(),
        owner
            .from('fabric_stock_sales')
            .select('id, meters_sold, dispatch_status, dispatched_meters, pending_dispatch_meters')
            .eq('org_id', orgId)
            .eq('id', saleId)
            .single(),
        owner
            .from('dispatches')
            .select('id, dispatch_number, qty_meters_sent, qty_meters_received, status, receipt_status')
            .eq('org_id', orgId)
            .eq('order_id', setup.orderId)
            .order('dispatch_number', { ascending: true }),
        owner
            .from('commercial_receivables')
            .select('id, total_amount, received_amount, balance_amount, payment_status')
            .eq('org_id', orgId)
            .eq('id', receivableId)
            .single(),
        owner
            .from('commercial_payment_receipts')
            .select('id, amount, payment_mode')
            .eq('org_id', orgId)
            .eq('receivable_id', receivableId),
        owner
            .from('stock_discrepancies')
            .select('id, dispatch_id, difference_meters, status')
            .eq('org_id', orgId)
            .eq('order_id', setup.orderId),
        owner
            .from('party_dispatch_claims')
            .select('id, dispatch_id, shortage_meters, claim_status')
            .eq('org_id', orgId)
            .eq('order_id', setup.orderId),
        owner
            .from('fabric_stock_sales')
            .select('pending_dispatch_meters')
            .eq('org_id', orgId)
            .gt('pending_dispatch_meters', 0.01),
        owner
            .from('dispatches')
            .select('id, qty_meters_sent')
            .eq('org_id', orgId)
            .eq('status', 'in_transit'),
    ])

    const error = progressResult.error || lotResult.error || saleResult.error || dispatchResult.error
        || receivableResult.error || receiptsResult.error || discrepancyResult.error || claimResult.error
        || pendingDispatchResult.error || inTransitResult.error
    if (error) throw new Error(`golden snapshot failed: ${error.message}`)

    return {
        order_progress: progressResult.data,
        lot: lotResult.data,
        sale: saleResult.data,
        dispatches: dispatchResult.data ?? [],
        receivable: receivableResult.data,
        payment_receipts: receiptsResult.data ?? [],
        discrepancies: discrepancyResult.data ?? [],
        party_claims: claimResult.data ?? [],
        factory_today_source: {
            pending_dispatch_rows: pendingDispatchResult.data?.length ?? 0,
            pending_dispatch_meters: round2((pendingDispatchResult.data ?? []).reduce((sum, row) => sum + Number(row.pending_dispatch_meters ?? 0), 0)),
            in_transit_dispatches: inTransitResult.data?.length ?? 0,
            unresolved_discrepancies: (discrepancyResult.data ?? []).filter((row) => row.status === 'needs_review').length,
            receivable_balance: numberValue(receivableResult.data?.balance_amount),
        },
    }
}

async function completeOrder(owner, resource, setup) {
    const { error: orderError } = await owner
        .from('orders')
        .update({ status: 'completed' })
        .eq('org_id', resource.orgId)
        .eq('id', setup.orderId)
    if (orderError) throw new Error(`failed to complete order: ${orderError.message}`)

    const { error: machineError } = await owner
        .from('machines')
        .update({ current_order_id: null, status: 'inactive' })
        .eq('org_id', resource.orgId)
        .eq('current_order_id', setup.orderId)
    if (machineError) throw new Error(`failed to unlink machines after completion: ${machineError.message}`)

    const [orderResult, machineResult] = await Promise.all([
        owner
            .from('orders')
            .select('id, status')
            .eq('org_id', resource.orgId)
            .eq('id', setup.orderId)
            .single(),
        owner
            .from('machines')
            .select('id, status, current_order_id')
            .eq('org_id', resource.orgId)
            .in('id', setup.machineIds),
    ])
    const error = orderResult.error || machineResult.error
    if (error) throw new Error(`completion snapshot failed: ${error.message}`)
    return {
        order: orderResult.data,
        machines: machineResult.data ?? [],
    }
}

function sanitizeEvidence(evidence) {
    return {
        ...evidence,
        org_id: safeId(evidence.org_id),
        users: evidence.users
            ? {
                owner_id: safeId(evidence.users.owner_id),
                supervisor_id: safeId(evidence.users.supervisor_id),
            }
            : undefined,
        ids: evidence.ids
            ? Object.fromEntries(Object.entries(evidence.ids).map(([key, value]) => {
                if (Array.isArray(value)) return [key, value.map(safeId)]
                return [key, safeId(value)]
            }))
            : undefined,
    }
}

async function writeArtifact(outputPath, payload) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`)
}

function classifyFailure(error) {
    const message = String(error?.message || error)
    if (/Missing Supabase|failed to sign in|failed to create disposable|Invalid API key|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(message)) {
        return 'harness_or_environment'
    }
    if (/schema cache|column .* does not exist|function .* does not exist|Could not find the function|relation .* does not exist/i.test(message)) {
        return 'schema_or_deployment_mismatch'
    }
    if (/TIME-|OFF-|SIGNOFF-/i.test(message)) {
        return 'out_of_scope_runtime_dependency'
    }
    return 'golden_a_product_or_runtime_failure'
}

async function main() {
    const env = await readEnv()
    const url = env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !anonKey || !serviceKey) {
        throw new Error('Missing Supabase URL, anon key, or service-role key in local env files.')
    }

    const runId = `B11-QA-${runTimestamp()}`
    const outputPath = path.join(workspace, 'output', 'qa', 'blocked-row-campaign', 'B11-qa-order-lifecycle.json')
    const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    const anon = { url, key: anonKey }
    const assertions = []
    const evidence = {
        run_id: runId,
        scope: 'B11 quote/order protected-history runtime closure proof',
        closure_targets: closureTargets,
        out_of_scope_not_closed: outOfScopeRows,
        disposable_qa_tenant: true,
    }

    let resource = null

    try {
        resource = await createDisposableTenant(admin, anon)
        evidence.org_id = resource.orgId
        evidence.users = {
            owner_id: resource.ownerUserId,
            supervisor_id: resource.supervisorUserId,
        }

        const setup = await seedGoldenASetup(resource.ownerClient, resource.orgId)
        evidence.ids = {
            quality_id: setup.qualityId,
            quote_id: setup.quoteId,
            order_id: setup.orderId,
            worker_ids: setup.workerIds,
            machine_ids: setup.machineIds,
        }

        const [quoteLink, requirementLink] = await Promise.all([
            resource.ownerClient
                .from('estimator_quotes')
                .select('id, order_id, status')
                .eq('org_id', resource.orgId)
                .eq('id', setup.quoteId)
                .single(),
            resource.ownerClient
                .from('order_yarn_requirements')
                .select('order_id, quote_id, total_required_kg')
                .eq('org_id', resource.orgId)
                .eq('order_id', setup.orderId)
                .single(),
        ])
        if (quoteLink.error || requirementLink.error) {
            throw new Error(`atomic order link read failed: ${quoteLink.error?.message ?? requirementLink.error?.message}`)
        }
        assertCondition(assertions, 'atomic Start Party Order links accepted quote, order, and yarn requirement',
            quoteLink.data.status === 'accepted'
            && quoteLink.data.order_id === setup.orderId
            && requirementLink.data.quote_id === setup.quoteId
            && near(requirementLink.data.total_required_kg, 30), {
                quote_status: quoteLink.data.status,
                quote_order_match: quoteLink.data.order_id === setup.orderId,
                requirement_quote_match: requirementLink.data.quote_id === setup.quoteId,
                total_required_kg: numberValue(requirementLink.data.total_required_kg),
            })

        const initialReplace = await replaceProduction(resource.supervisorClient, setup, false)
        const initialProduction = await productionSnapshot(resource.ownerClient, resource.orgId, setup)
        assertCondition(assertions, 'initial production inserts two logs', Number(initialReplace?.inserted_count ?? 0) === 2 && Number(initialReplace?.replaced_count ?? 0) === 0, initialReplace ?? {})
        assertCondition(assertions, 'initial order progress reflects produced meters', near(initialProduction.order_progress?.total_meters_produced, 230.75), initialProduction.order_progress ?? {})
        assertCondition(assertions, 'initial generated stock lot is order-linked', initialProduction.lots.length === 1 && initialProduction.lots[0].order_id === setup.orderId && initialProduction.lots[0].source_type === 'order', {
            lot_count: initialProduction.lots.length,
            source_type: initialProduction.lots[0]?.source_type,
            order_id: safeId(initialProduction.lots[0]?.order_id),
        })
        assertCondition(assertions, 'initial generated stock meters match production', near(initialProduction.lots[0]?.original_meters, 230.75) && near(initialProduction.lots[0]?.available_meters, 230.75), {
            original_meters: numberValue(initialProduction.lots[0]?.original_meters),
            available_meters: numberValue(initialProduction.lots[0]?.available_meters),
        })

        const overTargetPayload = productionPayload(setup, [130.5, 110.25])
        const overTargetAttempt = await resource.supervisorClient.rpc('replace_shift_production_logs', {
            p_logs: overTargetPayload,
            p_allow_overwrite: true,
            p_access_code_used: false,
        })
        const afterOverTarget = await productionSnapshot(resource.ownerClient, resource.orgId, setup)
        assertCondition(assertions, 'over-target production is explicitly rejected without downstream mutation',
            Boolean(overTargetAttempt.error)
            && /target|exceed/i.test(overTargetAttempt.error?.message ?? '')
            && near(afterOverTarget.production_meters, 230.75)
            && near(afterOverTarget.lots[0]?.original_meters, 230.75), {
                error: overTargetAttempt.error?.message ?? null,
                production_meters: afterOverTarget.production_meters,
                stock_meters: numberValue(afterOverTarget.lots[0]?.original_meters),
            })

        const correctedReplace = await replaceProduction(resource.supervisorClient, setup, true)
        const correctedProduction = await productionSnapshot(resource.ownerClient, resource.orgId, setup)
        assertCondition(assertions, 'production correction replaces prior logs atomically', Number(correctedReplace?.inserted_count ?? 0) === 2 && Number(correctedReplace?.replaced_count ?? 0) === 2, correctedReplace ?? {})
        assertCondition(assertions, 'corrected order progress reaches target meters', near(correctedProduction.order_progress?.total_meters_produced, TARGET_METERS) && near(correctedProduction.order_progress?.progress_percent, 100), correctedProduction.order_progress ?? {})
        assertCondition(assertions, 'corrected generated stock lot updates in place', correctedProduction.lots.length === 1 && near(correctedProduction.lots[0]?.original_meters, TARGET_METERS) && near(correctedProduction.lots[0]?.available_meters, TARGET_METERS), {
            lot_count: correctedProduction.lots.length,
            original_meters: numberValue(correctedProduction.lots[0]?.original_meters),
            available_meters: numberValue(correctedProduction.lots[0]?.available_meters),
        })
        assertCondition(assertions, 'production stock movement history includes initial and correction deltas', correctedProduction.movements.length >= 2 && correctedProduction.movements.some((row) => near(row.meters_delta, 5)), {
            movement_count: correctedProduction.movements.length,
            deltas: correctedProduction.movements.map((row) => numberValue(row.meters_delta)),
        })

        const cycleStart = `${setup.today.slice(0, 7)}-01`
        const settlementResult = await resource.ownerClient.rpc('settle_worker_payroll_hardened', {
            p_org_id: resource.orgId,
            p_worker_type: 'meter',
            p_worker_id: setup.workerIds[0],
            p_cycle_start: cycleStart,
            p_gross_amount: 0,
            p_is_final_settlement: false,
            p_manual_deduction_override: null,
            p_actor_id: resource.ownerUserId,
            p_payment_mode: 'cash',
            p_manual_adjustments: [],
            p_verified_by_owner: true,
        })
        if (settlementResult.error) throw new Error(`payroll settlement failed: ${settlementResult.error.message}`)
        const settlementId = settlementResult.data?.settlement_id
        const settlementSnapshot = await resource.ownerClient
            .from('payroll_settlements')
            .select('id, status, gross_pay, net_payout, cycle_start_date, meter_worker_id')
            .eq('org_id', resource.orgId)
            .eq('id', settlementId)
            .single()
        if (settlementSnapshot.error) throw new Error(`payroll settlement read failed: ${settlementSnapshot.error.message}`)
        assertCondition(assertions, 'production-backed payroll settles the authoritative worker gross',
            settlementSnapshot.data.status === 'paid'
            && settlementSnapshot.data.meter_worker_id === setup.workerIds[0]
            && near(settlementSnapshot.data.gross_pay, TARGET_METERS * WORKER_RATE)
            && near(settlementResult.data?.server_calculated_gross, TARGET_METERS * WORKER_RATE), {
                status: settlementSnapshot.data.status,
                gross_pay: numberValue(settlementSnapshot.data.gross_pay),
                server_calculated_gross: numberValue(settlementResult.data?.server_calculated_gross),
            })

        const settledCorrectionPayload = productionPayload(setup, [124.5, 111.25])
        const settledCorrectionAttempt = await resource.supervisorClient.rpc('replace_shift_production_logs', {
            p_logs: settledCorrectionPayload,
            p_allow_overwrite: true,
            p_access_code_used: false,
        })
        const afterSettledCorrection = await productionSnapshot(resource.ownerClient, resource.orgId, setup)
        assertCondition(assertions, 'paid and completed production history rejects correction without mutation',
            Boolean(settledCorrectionAttempt.error)
            && /settled|payroll|non-active|active order/i.test(settledCorrectionAttempt.error?.message ?? '')
            && near(afterSettledCorrection.production_meters, TARGET_METERS)
            && near(afterSettledCorrection.lots[0]?.original_meters, TARGET_METERS), {
                error: settledCorrectionAttempt.error?.message ?? null,
                production_meters: afterSettledCorrection.production_meters,
                stock_meters: numberValue(afterSettledCorrection.lots[0]?.original_meters),
            })

        evidence.payroll = {
            settlement: settlementSnapshot.data,
            over_target_rejection: overTargetAttempt.error?.message ?? null,
            settled_correction_rejection: settledCorrectionAttempt.error?.message ?? null,
        }

        setup.stockLotId = correctedProduction.lots[0].stock_lot_id
        evidence.ids.stock_lot_id = setup.stockLotId
        evidence.production = {
            initial: initialProduction,
            corrected: correctedProduction,
        }

        const saleResult = await createSaleOnly(resource.ownerClient, setup)
        const saleId = saleResult?.sale_id
        const receivableId = saleResult?.receivable_id
        evidence.ids.sale_id = saleId
        evidence.ids.receivable_id = receivableId
        evidence.ids.party_id = saleResult?.party_id

        assertCondition(assertions, 'sale-only stock sale returns no dispatch id', saleId && !saleResult?.dispatch_id, {
            sale_id: safeId(saleId),
            dispatch_id: safeId(saleResult?.dispatch_id),
        })
        assertCondition(assertions, 'sale-only stock sale keeps all sold meters pending dispatch', near(saleResult?.pending_dispatch_meters, SOLD_METERS), {
            pending_dispatch_meters: numberValue(saleResult?.pending_dispatch_meters),
        })

        const saleAfterCreate = await saleSnapshot(resource.ownerClient, resource.orgId, saleId)
        assertCondition(assertions, 'sale-only creates exactly one receivable', saleAfterCreate.receivables.length === 1 && saleAfterCreate.receivables[0].id === receivableId, {
            receivable_count: saleAfterCreate.receivables.length,
        })
        assertCondition(assertions, 'sale-only receivable amount and balance are exact', near(saleAfterCreate.receivables[0]?.total_amount, TOTAL_RECEIVABLE) && near(saleAfterCreate.receivables[0]?.balance_amount, TOTAL_RECEIVABLE) && saleAfterCreate.receivables[0]?.payment_status === 'unpaid', saleAfterCreate.receivables[0] ?? {})
        assertCondition(assertions, 'sale-only stock movement is recorded once', saleAfterCreate.sale_movements.length === 1 && near(saleAfterCreate.sale_movements[0]?.meters_delta, -SOLD_METERS), {
            sale_movement_count: saleAfterCreate.sale_movements.length,
            meters_delta: numberValue(saleAfterCreate.sale_movements[0]?.meters_delta),
        })

        const firstDispatch = await createOrderDispatch(resource.ownerClient, resource, setup, saleId, DISPATCH_1_METERS, 1)
        evidence.ids.dispatch_1_id = firstDispatch?.dispatch_id
        const dispatchAfterFirst = await dispatchSnapshot(resource.ownerClient, resource.orgId, setup.orderId, saleId)
        assertCondition(assertions, 'first order-linked dispatch is numbered and pending sale balance remains', firstDispatch?.dispatch_number === 1 && near(firstDispatch?.qty_meters_sent, DISPATCH_1_METERS) && near(dispatchAfterFirst.sale?.pending_dispatch_meters, DISPATCH_2_METERS), {
            dispatch_number: firstDispatch?.dispatch_number,
            qty_meters_sent: numberValue(firstDispatch?.qty_meters_sent),
            pending_dispatch_meters: numberValue(dispatchAfterFirst.sale?.pending_dispatch_meters),
        })

        const firstReceipt = await confirmReceipt(resource.ownerClient, resource, setup, firstDispatch.dispatch_id, DISPATCH_1_METERS, DISPATCH_1_METERS, 'Batch 6 exact receipt')
        const firstReceiptSnapshot = await receiptSnapshot(resource.ownerClient, resource.orgId, firstDispatch.dispatch_id)
        assertCondition(assertions, 'first receipt is delivered with exact received meters', near(firstReceipt?.qty_received, DISPATCH_1_METERS) && near(firstReceipt?.shortage_meters, 0) && firstReceiptSnapshot.dispatch?.status === 'delivered' && firstReceiptSnapshot.dispatch?.receipt_status === 'matched', {
            rpc: firstReceipt,
            dispatch: firstReceiptSnapshot.dispatch,
        })
        assertCondition(assertions, 'exact receipt creates no discrepancy or claim', firstReceiptSnapshot.discrepancies.length === 0 && firstReceiptSnapshot.claims.length === 0, {
            discrepancy_count: firstReceiptSnapshot.discrepancies.length,
            claim_count: firstReceiptSnapshot.claims.length,
        })

        const secondDispatch = await createOrderDispatch(resource.ownerClient, resource, setup, saleId, DISPATCH_2_METERS, 2)
        evidence.ids.dispatch_2_id = secondDispatch?.dispatch_id
        const dispatchAfterSecond = await dispatchSnapshot(resource.ownerClient, resource.orgId, setup.orderId, saleId)
        assertCondition(assertions, 'second order-linked dispatch drains sale pending meters', secondDispatch?.dispatch_number === 2 && near(secondDispatch?.qty_meters_sent, DISPATCH_2_METERS) && near(dispatchAfterSecond.sale?.pending_dispatch_meters, 0), {
            dispatch_number: secondDispatch?.dispatch_number,
            qty_meters_sent: numberValue(secondDispatch?.qty_meters_sent),
            pending_dispatch_meters: numberValue(dispatchAfterSecond.sale?.pending_dispatch_meters),
        })

        const secondReceipt = await confirmReceipt(resource.ownerClient, resource, setup, secondDispatch.dispatch_id, DISPATCH_2_METERS, DISPATCH_2_RECEIVED, 'Batch 6 shortage receipt')
        const secondReceiptSnapshot = await receiptSnapshot(resource.ownerClient, resource.orgId, secondDispatch.dispatch_id)
        assertCondition(assertions, 'second receipt records shortage accurately', near(secondReceipt?.qty_received, DISPATCH_2_RECEIVED) && near(secondReceipt?.shortage_meters, 5) && secondReceiptSnapshot.dispatch?.status === 'delivered' && secondReceiptSnapshot.dispatch?.receipt_status === 'difference_reported', {
            rpc: secondReceipt,
            dispatch: secondReceiptSnapshot.dispatch,
        })
        assertCondition(assertions, 'short receipt creates one open discrepancy', secondReceiptSnapshot.discrepancies.length === 1 && near(secondReceiptSnapshot.discrepancies[0]?.difference_meters, -5) && secondReceiptSnapshot.discrepancies[0]?.discrepancy_type === 'shortage' && secondReceiptSnapshot.discrepancies[0]?.status === 'needs_review', {
            discrepancies: secondReceiptSnapshot.discrepancies,
        })
        assertCondition(assertions, 'short receipt creates one open party claim', secondReceiptSnapshot.claims.length === 1 && near(secondReceiptSnapshot.claims[0]?.shortage_meters, 5) && secondReceiptSnapshot.claims[0]?.claim_status === 'open', {
            claims: secondReceiptSnapshot.claims,
        })

        await recordPayment(resource.ownerClient, receivableId, PARTIAL_PAYMENT, 'cash', setup, 'partial')
        const partialPayment = await paymentSnapshot(resource.ownerClient, resource.orgId, receivableId)
        assertCondition(assertions, 'partial payment leaves exact receivable balance', near(partialPayment.receivable?.received_amount, PARTIAL_PAYMENT) && near(partialPayment.receivable?.balance_amount, FINAL_PAYMENT) && partialPayment.receivable?.payment_status === 'partial' && partialPayment.receipts.length === 1, {
            receivable: partialPayment.receivable,
            receipt_count: partialPayment.receipts.length,
        })

        await recordPayment(resource.ownerClient, receivableId, FINAL_PAYMENT, 'bank', setup, 'final')
        const finalPayment = await paymentSnapshot(resource.ownerClient, resource.orgId, receivableId)
        const receiptTotal = round2(finalPayment.receipts.reduce((sum, row) => sum + Number(row.amount ?? 0), 0))
        assertCondition(assertions, 'final payment zeroes receivable with visible payment history', near(finalPayment.receivable?.received_amount, TOTAL_RECEIVABLE) && near(finalPayment.receivable?.balance_amount, 0) && finalPayment.receivable?.payment_status === 'paid' && finalPayment.receipts.length === 2 && near(receiptTotal, TOTAL_RECEIVABLE), {
            receivable: finalPayment.receivable,
            receipt_count: finalPayment.receipts.length,
            receipt_total: receiptTotal,
        })

        const firstSessionGolden = await goldenSnapshot(resource.ownerClient, resource.orgId, setup, saleId, receivableId)
        const secondSessionGolden = await goldenSnapshot(resource.ownerSecondClient, resource.orgId, setup, saleId, receivableId)
        evidence.golden_runtime = {
            sale_after_create: saleAfterCreate,
            dispatch_after_first: dispatchAfterFirst,
            first_receipt: firstReceiptSnapshot,
            dispatch_after_second: dispatchAfterSecond,
            second_receipt: secondReceiptSnapshot,
            partial_payment: partialPayment,
            final_payment: finalPayment,
            first_session: firstSessionGolden,
            second_session: secondSessionGolden,
        }

        assertCondition(assertions, 'first session shows closed Golden A chain', near(firstSessionGolden.order_progress?.total_meters_produced, TARGET_METERS)
            && near(firstSessionGolden.lot?.available_meters, TARGET_METERS - SOLD_METERS)
            && near(firstSessionGolden.sale?.pending_dispatch_meters, 0)
            && firstSessionGolden.dispatches.length === 2
            && firstSessionGolden.dispatches.every((dispatch) => dispatch.status === 'delivered')
            && near(firstSessionGolden.receivable?.balance_amount, 0)
            && firstSessionGolden.payment_receipts.length === 2
            && firstSessionGolden.discrepancies.length === 1, {
            order_progress: firstSessionGolden.order_progress,
            lot: firstSessionGolden.lot,
            sale: firstSessionGolden.sale,
            dispatch_count: firstSessionGolden.dispatches.length,
            receipt_count: firstSessionGolden.payment_receipts.length,
            discrepancy_count: firstSessionGolden.discrepancies.length,
        })
        assertCondition(assertions, 'second owner session matches committed Golden A state', near(secondSessionGolden.order_progress?.total_meters_produced, TARGET_METERS)
            && near(secondSessionGolden.lot?.available_meters, TARGET_METERS - SOLD_METERS)
            && near(secondSessionGolden.sale?.pending_dispatch_meters, 0)
            && secondSessionGolden.dispatches.length === 2
            && secondSessionGolden.dispatches.every((dispatch) => dispatch.status === 'delivered')
            && near(secondSessionGolden.receivable?.balance_amount, 0)
            && secondSessionGolden.payment_receipts.length === 2
            && secondSessionGolden.discrepancies.length === 1, {
            order_progress: secondSessionGolden.order_progress,
            lot: secondSessionGolden.lot,
            sale: secondSessionGolden.sale,
            dispatch_count: secondSessionGolden.dispatches.length,
            receipt_count: secondSessionGolden.payment_receipts.length,
            discrepancy_count: secondSessionGolden.discrepancies.length,
        })
        assertCondition(assertions, 'Factory Today source rows show no pending dispatch or receivable balance', firstSessionGolden.factory_today_source.pending_dispatch_rows === 0
            && near(firstSessionGolden.factory_today_source.pending_dispatch_meters, 0)
            && firstSessionGolden.factory_today_source.in_transit_dispatches === 0
            && near(firstSessionGolden.factory_today_source.receivable_balance, 0)
            && firstSessionGolden.factory_today_source.unresolved_discrepancies === 1, firstSessionGolden.factory_today_source)

        const completion = await completeOrder(resource.ownerClient, resource, setup)
        evidence.completion = completion
        assertCondition(assertions, 'completed order is archived and machines are unlinked', completion.order?.status === 'completed'
            && completion.machines.length === setup.machineIds.length
            && completion.machines.every((machine) => machine.current_order_id === null && machine.status === 'inactive'), completion)

        const { data: cancelOrder, error: cancelOrderError } = await resource.ownerClient
            .from('orders')
            .insert({
                org_id: resource.orgId,
                quality_id: setup.qualityId,
                party_name: 'Batch 6 Protected Cancel Buyer',
                total_target_meters: 100,
                start_date: setup.today,
                deadline: addDays(setup.today, 10),
                status: 'active',
                quality_label: 'Batch 6 Golden Fabric',
                worker_rate_per_m: WORKER_RATE,
                stock_meters_per_unit: STOCK_METERS_PER_UNIT,
                stock_unit_label: 'taka',
                default_godown: 'Batch 6 QA Godown',
            })
            .select('id')
            .single()
        if (cancelOrderError || !cancelOrder) throw new Error(`failed to create cancellation order: ${cancelOrderError?.message}`)

        const { data: cancelMachine, error: cancelMachineError } = await resource.ownerClient
            .from('machines')
            .insert({ org_id: resource.orgId, name: 'Batch 6 Protected Cancel Loom', status: 'inactive', loom_type: 'rapier' })
            .select('id')
            .single()
        if (cancelMachineError || !cancelMachine) throw new Error(`failed to create cancellation loom: ${cancelMachineError?.message}`)

        const cancelAssignments = await resource.ownerClient.from('machine_assignments').insert([
            { org_id: resource.orgId, machine_id: cancelMachine.id, worker_id: setup.workerIds[0], shift: 'day' },
            { org_id: resource.orgId, machine_id: cancelMachine.id, worker_id: setup.workerIds[1], shift: 'night' },
        ])
        if (cancelAssignments.error) throw new Error(`failed to create cancellation assignments: ${cancelAssignments.error.message}`)
        const cancelActivation = await resource.ownerClient
            .from('machines')
            .update({ current_order_id: cancelOrder.id, status: 'active' })
            .eq('org_id', resource.orgId)
            .eq('id', cancelMachine.id)
        if (cancelActivation.error) throw new Error(`failed to activate cancellation loom: ${cancelActivation.error.message}`)

        const partialCancelLog = [{
            machine_id: cancelMachine.id,
            worker_id: setup.workerIds[0],
            order_id: cancelOrder.id,
            meters: 40,
            opening_meter_reading: 0,
            closing_meter_reading: 40,
            counter_was_reset: false,
            shift: 'day',
            date: setup.today,
            worker_rate_snapshot: WORKER_RATE,
            submitted_at: new Date().toISOString(),
            client_ip: 'batch6-cancel-proof',
        }]
        const partialCancelResult = await resource.supervisorClient.rpc('replace_shift_production_logs', {
            p_logs: partialCancelLog,
            p_allow_overwrite: false,
            p_access_code_used: false,
        })
        if (partialCancelResult.error) throw new Error(`failed to create cancellation history: ${partialCancelResult.error.message}`)

        const cancelWrite = await resource.ownerClient
            .from('orders')
            .update({ status: 'cancelled' })
            .eq('org_id', resource.orgId)
            .eq('id', cancelOrder.id)
        if (cancelWrite.error) throw new Error(`failed to cancel protected order: ${cancelWrite.error.message}`)
        const cancelUnlink = await resource.ownerClient
            .from('machines')
            .update({ current_order_id: null, status: 'inactive' })
            .eq('org_id', resource.orgId)
            .eq('current_order_id', cancelOrder.id)
        if (cancelUnlink.error) throw new Error(`failed to unlink cancelled order loom: ${cancelUnlink.error.message}`)

        const postCancelAttempt = await resource.supervisorClient.rpc('replace_shift_production_logs', {
            p_logs: [{
                ...partialCancelLog[0],
                worker_id: setup.workerIds[1],
                shift: 'night',
                meters: 10,
                closing_meter_reading: 10,
            }],
            p_allow_overwrite: false,
            p_access_code_used: false,
        })
        const physicalDeleteAttempt = await resource.ownerClient
            .from('orders')
            .delete()
            .eq('org_id', resource.orgId)
            .eq('id', cancelOrder.id)

        const [cancelOrderState, cancelMachineState, cancelLogs, cancelLots, completedLot] = await Promise.all([
            resource.ownerClient.from('orders').select('id, status').eq('org_id', resource.orgId).eq('id', cancelOrder.id).single(),
            resource.ownerClient.from('machines').select('id, status, current_order_id').eq('org_id', resource.orgId).eq('id', cancelMachine.id).single(),
            resource.ownerClient.from('production_logs').select('id, meters, shift, order_id').eq('org_id', resource.orgId).eq('order_id', cancelOrder.id),
            resource.ownerClient.from('fabric_stock_lot_summary').select('stock_lot_id, stock_purpose, original_meters, available_meters, order_id').eq('org_id', resource.orgId).eq('order_id', cancelOrder.id),
            resource.ownerClient.from('fabric_stock_lot_summary').select('stock_lot_id, stock_purpose, original_meters, available_meters, sold_meters, order_id').eq('org_id', resource.orgId).eq('order_id', setup.orderId).single(),
        ])
        const cancelReadError = cancelOrderState.error || cancelMachineState.error || cancelLogs.error || cancelLots.error || completedLot.error
        if (cancelReadError) throw new Error(`cancelled-order readback failed: ${cancelReadError.message}`)

        assertCondition(assertions, 'cancel after partial production preserves history and unlinks only its loom',
            cancelOrderState.data.status === 'cancelled'
            && cancelMachineState.data.status === 'inactive'
            && cancelMachineState.data.current_order_id === null
            && cancelLogs.data.length === 1
            && near(cancelLogs.data[0]?.meters, 40), {
                order_status: cancelOrderState.data.status,
                machine: cancelMachineState.data,
                log_count: cancelLogs.data.length,
                meters: numberValue(cancelLogs.data[0]?.meters),
            })
        assertCondition(assertions, 'cancelled order rejects new production at the database boundary',
            Boolean(postCancelAttempt.error)
            && /active order|non-active|cancel/i.test(postCancelAttempt.error?.message ?? '')
            && cancelLogs.data.length === 1, {
                error: postCancelAttempt.error?.message ?? null,
                log_count: cancelLogs.data.length,
            })
        assertCondition(assertions, 'protected physical delete is restricted and the cancelled archive row remains',
            Boolean(physicalDeleteAttempt.error)
            && cancelOrderState.data.status === 'cancelled'
            && cancelLogs.data.length === 1, {
                delete_error: physicalDeleteAttempt.error?.message ?? null,
                order_status: cancelOrderState.data.status,
                log_count: cancelLogs.data.length,
            })
        assertCondition(assertions, 'order stock remains source-linked across completed and cancelled states',
            completedLot.data.stock_purpose === 'order_reserved'
            && completedLot.data.order_id === setup.orderId
            && cancelLots.data.length === 1
            && cancelLots.data[0].stock_purpose === 'order_reserved'
            && cancelLots.data[0].order_id === cancelOrder.id
            && near(cancelLots.data[0].original_meters, 40), {
                completed_lot: completedLot.data,
                cancelled_lots: cancelLots.data,
            })

        evidence.cancelled_order = {
            order: cancelOrderState.data,
            machine: cancelMachineState.data,
            logs: cancelLogs.data,
            lots: cancelLots.data,
            rejected_new_production: postCancelAttempt.error?.message ?? null,
            rejected_physical_delete: physicalDeleteAttempt.error?.message ?? null,
        }
        evidence.stock_lifecycle = {
            active: initialProduction.lots[0],
            completed: completedLot.data,
            cancelled: cancelLots.data[0],
        }

        const output = {
            passed: true,
            ...sanitizeEvidence(evidence),
            assertions,
            cleanup: 'pending',
        }
        await writeArtifact(outputPath, output)

        const cleanupErrors = await cleanupDisposable(admin, resource, { throwOnError: true })
        resource = null

        output.cleanup = 'complete'
        output.cleanup_errors = cleanupErrors
        await writeArtifact(outputPath, output)

        console.log(JSON.stringify({
            passed: true,
            outputPath,
            assertion_count: assertions.length,
            assertions: assertions.map(({ name, passed }) => ({ name, passed })),
        }, null, 2))
    } catch (error) {
        let cleanupErrors = []
        if (resource) cleanupErrors = await cleanupDisposable(admin, resource)

        const failed = {
            passed: false,
            ...sanitizeEvidence(evidence),
            failure_classification: classifyFailure(error),
            error: String(error?.message || error),
            assertions,
            cleanup: resource ? 'attempted' : 'not_required',
            cleanup_errors: cleanupErrors,
        }
        await writeArtifact(outputPath, failed)
        console.error(JSON.stringify({
            passed: false,
            outputPath,
            failure_classification: failed.failure_classification,
            error: failed.error,
            cleanup_errors: cleanupErrors,
        }, null, 2))
        throw error
    }
}

await main()
