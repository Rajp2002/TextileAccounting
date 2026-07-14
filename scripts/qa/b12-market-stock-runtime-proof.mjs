#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const workspace = process.cwd()
const QA_REF = 'eutycrtzzxmlkcpipgod'
const PROD_REF = 'vzhwahudircrpgtitwzd'
const productionMode = process.argv.includes('--production')
const environment = productionMode ? 'production' : 'qa'
const projectRef = productionMode ? PROD_REF : QA_REF
const deploymentId = process.env.B12_DEPLOYMENT_ID ?? null
const deploymentCommit = process.env.B12_DEPLOYMENT_COMMIT ?? null
const closureTargets = [
    'MARKET-009', 'MARKET-010', 'MARKET-013', 'STOCK-005', 'STOCK-009',
    'DISP-017', 'DISP-018', 'COMM-015', 'GOLDEN-B-12', 'GOLDEN-B-17',
]

function parseEnv(contents) {
    return Object.fromEntries(contents.split(/\r?\n/).flatMap((raw) => {
        const line = raw.trim()
        if (!line || line.startsWith('#') || !line.includes('=')) return []
        const separator = line.indexOf('=')
        let value = line.slice(separator + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
        }
        return [[line.slice(0, separator), value]]
    }))
}

function safeId(value) {
    return typeof value === 'string' ? `${value.slice(0, 8)}...${value.slice(-4)}` : null
}

function todayDate() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
}

function rowFromRpc(data) {
    return Array.isArray(data) ? data[0] : data
}

function numberValue(value) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

function near(actual, expected, tolerance = 0.01) {
    const parsed = numberValue(actual)
    return parsed !== null && Math.abs(parsed - expected) <= tolerance
}

function assertCondition(assertions, name, passed, details = {}) {
    assertions.push({ name, passed, ...details })
    if (!passed) throw new Error(`${name} failed: ${JSON.stringify(details)}`)
}

function clientFor(url, key) {
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function createUser(admin, label, suffix) {
    const email = `b12-${label}-${suffix}@qa.weavly.local`
    const password = `B12-${label}-${suffix}-${crypto.randomBytes(8).toString('hex')}!`
    const result = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: `B12 ${label}` },
    })
    if (result.error || !result.data.user) throw new Error(`create ${label} auth user failed: ${result.error?.message}`)
    return { id: result.data.user.id, email, password }
}

async function createOrg(admin, owner, suffix, label) {
    const result = await admin.from('organizations').insert({
        name: `B12 ${label} ${suffix}`,
        owner_id: owner.id,
        join_code: `B12${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        join_code_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        onboarding_complete: true,
        production_mode: 'both',
    }).select('id').single()
    if (result.error || !result.data) throw new Error(`create ${label} org failed: ${result.error?.message}`)
    const profile = await admin.from('profiles').insert({
        id: owner.id, org_id: result.data.id, role: 'owner', full_name: `B12 ${label}`, email: owner.email,
    })
    if (profile.error) throw new Error(`create ${label} profile failed: ${profile.error.message}`)
    return result.data.id
}

async function signIn(url, anonKey, user, label) {
    const client = clientFor(url, anonKey)
    const result = await client.auth.signInWithPassword({ email: user.email, password: user.password })
    if (result.error || !result.data.user) throw new Error(`${label} sign-in failed: ${result.error?.message}`)
    return client
}

async function createFixture(admin, url, anonKey) {
    const suffix = crypto.randomBytes(5).toString('hex')
    const owner = await createUser(admin, 'owner', suffix)
    const adversary = await createUser(admin, 'adversary', suffix)
    const orgId = await createOrg(admin, owner, suffix, 'Market Owner')
    const adversaryOrgId = await createOrg(admin, adversary, suffix, 'Adversary')
    const subscription = await admin.from('org_subscriptions').insert({
        org_id: orgId,
        plan_id: 'trial',
        plan_tier: 'premium',
        status: 'active',
        current_end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    if (subscription.error) throw new Error(`create subscription failed: ${subscription.error.message}`)
    return {
        orgId,
        adversaryOrgId,
        ownerUserId: owner.id,
        adversaryUserId: adversary.id,
        owner: await signIn(url, anonKey, owner, 'owner'),
        ownerSecond: await signIn(url, anonKey, owner, 'second owner'),
    }
}

async function cleanup(admin, fixture) {
    if (!fixture) return { errors: ['fixture was not created'], reconciled: false }
    const errors = []
    const orgIds = [fixture.orgId, fixture.adversaryOrgId]
    const tables = [
        'commercial_payment_receipts', 'commercial_receivables', 'party_dispatch_claims',
        'dispatch_package_lines', 'fabric_packages', 'stock_discrepancies', 'dispatches',
        'fabric_stock_movements', 'fabric_stock_sales', 'fabric_stock_inward_drafts',
        'fabric_stock_lots', 'market_run_sales', 'production_logs',
        ...(productionMode ? ['machine_operator_assignments'] : []),
        'machine_assignments',
        'machines', 'workers', 'order_yarn_requirements',
        'orders', 'estimator_quotes', 'market_runs', 'org_subscriptions', 'parties', 'audit_log',
    ]
    for (const table of tables) {
        try {
            const result = await admin.from(table).delete().in('org_id', orgIds)
            if (result.error) errors.push(`${table}: ${result.error.message}`)
        } catch (error) {
            errors.push(`${table}: ${String(error?.message ?? error)}`)
        }
    }
    const userIds = [fixture.ownerUserId, fixture.adversaryUserId]
    const profiles = await admin.from('profiles').delete().in('id', userIds)
    if (profiles.error) errors.push(`profiles: ${profiles.error.message}`)
    const orgs = await admin.from('organizations').delete().in('id', orgIds)
    if (orgs.error) errors.push(`organizations: ${orgs.error.message}`)
    for (const userId of userIds) {
        const result = await admin.auth.admin.deleteUser(userId)
        if (result.error && result.error.code !== 'user_not_found') errors.push(`auth ${safeId(userId)}: ${result.error.message}`)
    }
    const [orgCount, profileCount, lotCount, authA, authB] = await Promise.all([
        admin.from('organizations').select('id', { count: 'exact', head: true }).in('id', orgIds),
        admin.from('profiles').select('id', { count: 'exact', head: true }).in('id', userIds),
        admin.from('fabric_stock_lots').select('id', { count: 'exact', head: true }).in('org_id', orgIds),
        admin.auth.admin.getUserById(userIds[0]),
        admin.auth.admin.getUserById(userIds[1]),
    ])
    const reconciliation = {
        organizations: orgCount.count,
        profiles: profileCount.count,
        stock_lots: lotCount.count,
        auth_users_exist: [authA, authB].filter((row) => Boolean(row.data.user)).length,
    }
    return {
        errors,
        reconciliation,
        reconciled: errors.length === 0 && Object.values(reconciliation).every((value) => value === 0),
    }
}

function lotRow(orgId, overrides = {}) {
    return {
        org_id: orgId,
        quality_label: 'B12 Market Fabric',
        godown: 'B12 QA Godown',
        source_type: 'manual',
        original_taka_count: 2,
        available_taka_count: 2,
        meters_per_taka: 50,
        unit_label: 'taka',
        original_meters: 100,
        available_meters: 100,
        stock_purpose: 'manual',
        cost_per_meter: 20,
        received_date: todayDate(),
        notes: 'B12 disposable runtime proof',
        ...overrides,
    }
}

async function createSale(owner, lotId, overrides = {}) {
    const result = await owner.rpc('create_party_stock_sale_dispatch_v1', {
        p_source_type: 'stock_lot',
        p_source_id: lotId,
        p_party_name: 'B12 Duplicate Buyer',
        p_party_phone: '9000000012',
        p_party_city: 'Surat',
        p_party_gstin: null,
        p_sold_meters: 100,
        p_sold_takas: null,
        p_sale_rate_per_meter: 1000,
        p_credit_days: 7,
        p_sale_date: todayDate(),
        p_dispatch_now: false,
        p_actual_dispatched_meters: null,
        p_dispatch_date: null,
        p_transport_name: null,
        p_vehicle_number: null,
        p_challan_number: null,
        p_notes: 'B12 market sale',
        p_party_id: null,
        p_idempotency_key: `b12-sale:${crypto.randomUUID()}`,
        ...overrides,
    })
    return { ...result, row: rowFromRpc(result.data) }
}

async function createDispatch(owner, fixture, orderId, saleId, meters, index) {
    const result = await owner.rpc('create_stock_sale_dispatch', {
        p_org_id: fixture.orgId,
        p_order_id: orderId,
        p_sale_ids: [saleId],
        p_dispatch_meters: [meters],
        p_dispatch_takas: [1],
        p_dispatch_date: todayDate(),
        p_notes: `B12 exact batch ${index}`,
        p_eway_bill_number: null,
        p_vehicle_number: null,
        p_transporter_name: null,
        p_transporter_id: null,
        p_approximate_distance_km: null,
        p_eway_bill_generated_at: null,
        p_created_by: fixture.ownerUserId,
        p_idempotency_key: `b12-dispatch-${index}:${crypto.randomUUID()}`,
    })
    if (result.error) throw new Error(`create dispatch ${index} failed: ${result.error.message}`)
    return rowFromRpc(result.data)
}

async function confirmExactReceipt(owner, trackingToken, dispatchId, meters) {
    const result = await owner.rpc('confirm_fabric_dispatch_receipt', {
        p_dispatch_id: dispatchId,
        p_tracking_token: trackingToken,
        p_qty_received: meters,
    })
    if (result.error) throw new Error(`confirm exact receipt failed: ${result.error.message}`)
    return rowFromRpc(result.data)
}

async function seedSourceValidation(admin, fixture, assertions) {
    const today = todayDate()
    const orders = await admin.from('orders').insert([
        { org_id: fixture.orgId, party_name: 'B12 Source A', quality_label: 'Source A', warp_instruction: '', weft_instruction: '', total_target_meters: 10, start_date: today, deadline: today, status: 'active', tracking_token: `B12-${crypto.randomUUID()}` },
        { org_id: fixture.orgId, party_name: 'B12 Source B', quality_label: 'Source B', warp_instruction: '', weft_instruction: '', total_target_meters: 10, start_date: today, deadline: today, status: 'active', tracking_token: `B12-${crypto.randomUUID()}` },
    ]).select('id, party_name')
    if (orders.error || orders.data?.length !== 2) throw new Error(`seed source orders failed: ${orders.error?.message}`)
    const quotes = await admin.from('estimator_quotes').insert([
        { org_id: fixture.orgId, party_name: 'B12 Source A', quality_label: 'Source A', meters: 10, status: 'accepted', landed_cost_per_meter: 20, quote_price_per_meter: 30, intended_margin_percent: 33.33, ppi: 68, yarn_denier: 75, yarn_rate_per_kg: 100, order_id: orders.data[0].id },
        { org_id: fixture.orgId, party_name: 'B12 Source B', quality_label: 'Source B', meters: 10, status: 'accepted', landed_cost_per_meter: 20, quote_price_per_meter: 30, intended_margin_percent: 33.33, ppi: 68, yarn_denier: 75, yarn_rate_per_kg: 100, order_id: orders.data[1].id },
    ]).select('id, order_id, party_name')
    if (quotes.error || quotes.data?.length !== 2) throw new Error(`seed source quotes failed: ${quotes.error?.message}`)
    const adversaryRun = await admin.from('market_runs').insert({
        org_id: fixture.adversaryOrgId, fabric_label: 'B12 Cross Tenant', quality_label: 'Cross Tenant',
        target_meters: 10, cost_per_meter: 20, status: 'production',
    }).select('id').single()
    if (adversaryRun.error || !adversaryRun.data) throw new Error(`seed adversary run failed: ${adversaryRun.error?.message}`)

    const crossTenant = await fixture.owner.from('fabric_stock_lots').insert(lotRow(fixture.orgId, {
        source_type: 'market_run', market_run_id: adversaryRun.data.id, stock_purpose: 'sellable',
    }))
    assertCondition(assertions, 'cross-tenant stock source is rejected at the database boundary', Boolean(crossTenant.error), {
        error: crossTenant.error?.message,
    })

    const mismatch = await fixture.owner.from('fabric_stock_lots').insert(lotRow(fixture.orgId, {
        source_type: 'order', order_id: orders.data[0].id, quote_id: quotes.data[1].id, stock_purpose: 'order_reserved',
    }))
    assertCondition(assertions, 'mismatched quote and order stock source is rejected', Boolean(mismatch.error), {
        error: mismatch.error?.message,
    })

    const invalidLots = await admin.from('fabric_stock_lots').select('id', { count: 'exact', head: true })
        .eq('org_id', fixture.orgId)
    assertCondition(assertions, 'rejected stock sources leave no lot behind', invalidLots.count === 0, { count: invalidLots.count })
}

async function seedMainMarket(admin, fixture) {
    const today = todayDate()
    const run = await admin.from('market_runs').insert({
        org_id: fixture.orgId,
        fabric_label: 'B12 Golden Market Fabric',
        quality_label: 'B12 Golden Market Quality',
        target_meters: 100,
        cost_per_meter: 20,
        worker_rate_per_m: 2.5,
        status: 'production',
        notes: 'B12 disposable Golden B proof',
    }).select('id').single()
    if (run.error || !run.data) throw new Error(`create main market run failed: ${run.error?.message}`)
    const trackingToken = `B12-${crypto.randomUUID()}`
    const order = await admin.from('orders').insert({
        org_id: fixture.orgId,
        party_name: 'B12 Golden Market Fabric',
        quality_label: 'B12 Golden Market Quality',
        warp_instruction: '', weft_instruction: '', total_target_meters: 100,
        start_date: today, deadline: today, status: 'active', worker_rate_per_m: 2.5,
        tracking_token: trackingToken, market_run_id: run.data.id,
    }).select('id').single()
    if (order.error || !order.data) throw new Error(`create main market order failed: ${order.error?.message}`)
    const worker = await admin.from('workers').insert({
        org_id: fixture.orgId,
        name: 'B12 Market Worker',
        is_active: true,
        date_of_birth: '1990-01-01',
        age_verification_method: 'government_id',
        age_verification_reference: `b12-worker-${crypto.randomUUID()}`,
        age_verified_at: new Date().toISOString(),
        age_verified_by: fixture.ownerUserId,
    }).select('id').single()
    if (worker.error || !worker.data) throw new Error(`create market worker failed: ${worker.error?.message}`)
    const machine = await admin.from('machines').insert({
        org_id: fixture.orgId, name: 'B12 Market Loom', status: 'inactive', loom_type: 'rapier',
    }).select('id').single()
    if (machine.error || !machine.data) throw new Error(`create market loom failed: ${machine.error?.message}`)
    const assignments = await admin.from('machine_assignments').insert([
        { org_id: fixture.orgId, machine_id: machine.data.id, worker_id: worker.data.id, shift: 'day' },
        { org_id: fixture.orgId, machine_id: machine.data.id, worker_id: worker.data.id, shift: 'night' },
    ])
    if (assignments.error) throw new Error(`create market assignments failed: ${assignments.error.message}`)
    let operatorAssignmentId = null
    if (productionMode) {
        const operator = await admin.from('machine_operator_assignments').insert({
            org_id: fixture.orgId,
            worker_type: 'meter_worker',
            meter_worker_id: worker.data.id,
            fixed_worker_id: null,
            machine_id: machine.data.id,
            machine_type: 'rapier',
            shift: 'day',
            pay_mode: 'per_meter',
            rate: 2.5,
            effective_from: today,
            is_primary_operator: true,
            active: true,
        }).select('id').single()
        if (operator.error || !operator.data) throw new Error(`create market operator assignment failed: ${operator.error?.message}`)
        operatorAssignmentId = operator.data.id
    }
    const activation = await admin.from('machines').update({ current_order_id: order.data.id, status: 'active' })
        .eq('id', machine.data.id)
    if (activation.error) throw new Error(`activate market loom failed: ${activation.error.message}`)
    const productionLog = {
        org_id: fixture.orgId, order_id: order.data.id, machine_id: machine.data.id,
        worker_id: worker.data.id, meters: 100, date: today, shift: 'day',
        worker_rate_snapshot: 2.5, created_by: fixture.ownerUserId, client_ip: 'b12-runtime',
    }
    if (productionMode) {
        Object.assign(productionLog, {
            operator_assignment_id: operatorAssignmentId,
            operator_worker_type: 'meter_worker',
            meter_worker_id: worker.data.id,
            fixed_worker_id: null,
            operator_pay_mode_snapshot: 'per_meter',
            operator_rate_snapshot: 2.5,
            machine_type_snapshot: 'rapier',
        })
    }
    const log = await admin.from('production_logs').insert(productionLog)
    if (log.error) throw new Error(`create main market production failed: ${log.error.message}`)
    const lot = await fixture.owner.from('fabric_stock_lots').insert(lotRow(fixture.orgId, {
        source_type: 'market_run', market_run_id: run.data.id, order_id: order.data.id,
        stock_purpose: 'sellable', created_by: fixture.ownerUserId,
    })).select('id').single()
    if (lot.error || !lot.data) throw new Error(`create main market lot failed: ${lot.error?.message}`)
    return { marketRunId: run.data.id, orderId: order.data.id, lotId: lot.data.id, trackingToken }
}

async function proveMarketClosure(admin, fixture, setup, assertions) {
    const sale = await createSale(fixture.owner, setup.lotId)
    if (sale.error || !sale.row?.sale_id) throw new Error(`main market sale failed: ${sale.error?.message}`)
    const soldOut = await fixture.owner.from('market_run_summary').select('*')
        .eq('org_id', fixture.orgId).eq('market_run_id', setup.marketRunId).single()
    if (soldOut.error) throw new Error(`sold-out summary failed: ${soldOut.error.message}`)
    const pending = await fixture.owner.from('fabric_stock_sales')
        .select('pending_dispatch_meters, dispatch_status').eq('id', sale.row.sale_id).single()
    assertCondition(assertions, 'sold-out market run keeps pending dispatch visible',
        near(soldOut.data.total_meters_produced, 100) && near(soldOut.data.total_meters_sold, 100)
        && near(soldOut.data.meters_in_godown, 0) && near(pending.data?.pending_dispatch_meters, 100), {
            produced: numberValue(soldOut.data.total_meters_produced),
            sold: numberValue(soldOut.data.total_meters_sold),
            godown: numberValue(soldOut.data.meters_in_godown),
            pending_dispatch_meters: numberValue(pending.data?.pending_dispatch_meters),
        })

    const first = await createDispatch(fixture.owner, fixture, setup.orderId, sale.row.sale_id, 60, 1)
    const firstRow = await fixture.owner.from('dispatches')
        .select('id, qty_meters_sent, eway_bill_required, eway_bill_number, challan_number, transporter_name, status')
        .eq('id', first.dispatch_id).single()
    if (firstRow.error) throw new Error(`first dispatch snapshot failed: ${firstRow.error.message}`)
    assertCondition(assertions, 'above-threshold dispatch is advisory and records missing compliance fields honestly',
        firstRow.data.eway_bill_required === true && !firstRow.data.eway_bill_number
        && !firstRow.data.challan_number && !firstRow.data.transporter_name && near(firstRow.data.qty_meters_sent, 60), firstRow.data)
    const firstReceipt = await confirmExactReceipt(fixture.owner, setup.trackingToken, first.dispatch_id, 60)
    assertCondition(assertions, 'first Golden B batch records an exact receipt', near(firstReceipt?.qty_received, 60) && near(firstReceipt?.shortage_meters, 0), firstReceipt)

    const afterFirst = await fixture.owner.from('fabric_stock_sales')
        .select('pending_dispatch_meters, dispatched_meters').eq('id', sale.row.sale_id).single()
    assertCondition(assertions, 'first dispatch leaves the second batch actionable',
        near(afterFirst.data?.pending_dispatch_meters, 40) && near(afterFirst.data?.dispatched_meters, 60), afterFirst.data)

    const second = await createDispatch(fixture.owner, fixture, setup.orderId, sale.row.sale_id, 40, 2)
    const secondRow = await fixture.owner.from('dispatches')
        .select('id, qty_meters_sent, eway_bill_required, eway_bill_number, challan_number, transporter_name, status')
        .eq('id', second.dispatch_id).single()
    if (secondRow.error) throw new Error(`second dispatch snapshot failed: ${secondRow.error.message}`)
    assertCondition(assertions, 'below-threshold dispatch remains a reminder rather than a compliance claim',
        secondRow.data.eway_bill_required === false && !secondRow.data.eway_bill_number
        && !secondRow.data.challan_number && !secondRow.data.transporter_name && near(secondRow.data.qty_meters_sent, 40), secondRow.data)
    const secondReceipt = await confirmExactReceipt(fixture.owner, setup.trackingToken, second.dispatch_id, 40)
    assertCondition(assertions, 'second Golden B batch records an exact receipt', near(secondReceipt?.qty_received, 40) && near(secondReceipt?.shortage_meters, 0), secondReceipt)

    const dispatches = await fixture.owner.from('dispatches')
        .select('id, dispatch_number, status, receipt_status, qty_meters_sent, qty_meters_received')
        .eq('org_id', fixture.orgId).eq('order_id', setup.orderId).order('dispatch_number')
    const finalSale = await fixture.owner.from('fabric_stock_sales')
        .select('pending_dispatch_meters, dispatched_meters, dispatch_status').eq('id', sale.row.sale_id).single()
    assertCondition(assertions, 'all sold stock is dispatched and both batches are received',
        dispatches.data?.length === 2 && dispatches.data.every((row) => row.status === 'delivered' && row.receipt_status === 'matched')
        && near(finalSale.data?.pending_dispatch_meters, 0) && near(finalSale.data?.dispatched_meters, 100), {
            dispatches: dispatches.data,
            sale: finalSale.data,
        })

    const closed = await fixture.owner.from('market_runs').update({ status: 'closed' })
        .eq('org_id', fixture.orgId).eq('id', setup.marketRunId).select('status').single()
    if (closed.error) throw new Error(`close market run failed: ${closed.error.message}`)
    const archive = await fixture.owner.from('market_run_summary').select('*')
        .eq('org_id', fixture.orgId).eq('market_run_id', setup.marketRunId).single()
    assertCondition(assertions, 'sold-out run closes with complete archive history',
        archive.data?.status === 'closed' && near(archive.data?.total_meters_produced, 100)
        && near(archive.data?.total_meters_sold, 100) && near(archive.data?.meters_in_godown, 0)
        && Number(archive.data?.sales_count) === 1, {
            status: archive.data?.status,
            produced: numberValue(archive.data?.total_meters_produced),
            sold: numberValue(archive.data?.total_meters_sold),
            godown: numberValue(archive.data?.meters_in_godown),
            sales_count: Number(archive.data?.sales_count),
        })

    return { saleId: sale.row.sale_id, partyId: sale.row.party_id, dispatchIds: [first.dispatch_id, second.dispatch_id] }
}

async function proveDuplicatePartyIdentity(admin, fixture, mainSale, assertions) {
    const lot = await fixture.owner.from('fabric_stock_lots').insert(lotRow(fixture.orgId, {
        quality_label: 'B12 Duplicate Identity Fabric', original_taka_count: 1, available_taka_count: 1,
        original_meters: 10, available_meters: 10, meters_per_taka: 10, created_by: fixture.ownerUserId,
    })).select('id').single()
    if (lot.error || !lot.data) throw new Error(`duplicate identity lot failed: ${lot.error?.message}`)
    const secondSale = await createSale(fixture.owner, lot.data.id, {
        p_party_name: '  b12 duplicate buyer  ',
        p_party_phone: '9000000099',
        p_sold_meters: 10,
        p_sale_rate_per_meter: 50,
        p_notes: 'B12 second same-name party',
    })
    if (secondSale.error || !secondSale.row?.sale_id) throw new Error(`second party sale failed: ${secondSale.error?.message}`)
    const parties = await fixture.owner.from('parties').select('id, name, phone').eq('org_id', fixture.orgId)
        .ilike('name', '%b12 duplicate buyer%')
    const receivables = await fixture.owner.from('commercial_receivables')
        .select('id, source_id, party_id, party_name, balance_amount').eq('org_id', fixture.orgId)
        .in('source_id', [mainSale.saleId, secondSale.row.sale_id])
    assertCondition(assertions, 'duplicate normalized names remain separate by party_id',
        parties.data?.length === 2 && new Set(parties.data.map((row) => row.id)).size === 2
        && mainSale.partyId !== secondSale.row.party_id, {
            parties: parties.data?.map((row) => ({ id: safeId(row.id), name: row.name, phone: row.phone })),
            first_party_id: safeId(mainSale.partyId),
            second_party_id: safeId(secondSale.row.party_id),
        })
    assertCondition(assertions, 'new receivables retain explicit distinct party identities',
        receivables.data?.length === 2 && receivables.data.every((row) => row.party_id)
        && new Set(receivables.data.map((row) => row.party_id)).size === 2, {
            receivables: receivables.data?.map((row) => ({ ...row, id: safeId(row.id), source_id: safeId(row.source_id), party_id: safeId(row.party_id) })),
        })
    return { secondSaleId: secondSale.row.sale_id, secondPartyId: secondSale.row.party_id }
}

async function proveConcurrentLotMutation(fixture, assertions) {
    const lot = await fixture.owner.from('fabric_stock_lots').insert(lotRow(fixture.orgId, {
        quality_label: 'B12 Concurrency Fabric', created_by: fixture.ownerUserId,
    })).select('id').single()
    if (lot.error || !lot.data) throw new Error(`concurrency lot failed: ${lot.error?.message}`)
    const [sale, adjustment] = await Promise.all([
        createSale(fixture.owner, lot.data.id, {
            p_party_name: 'B12 Concurrency Buyer', p_party_phone: '9000000088',
            p_sold_meters: 80, p_sale_rate_per_meter: 40, p_notes: 'B12 concurrent sale',
        }),
        fixture.ownerSecond.rpc('adjust_fabric_stock_lot', {
            p_stock_lot_id: lot.data.id, p_adjustment_mode: 'subtract', p_taka_count: 2,
            p_notes: 'B12 concurrent adjustment',
        }),
    ])
    const successCount = [!sale.error, !adjustment.error].filter(Boolean).length
    const snapshot = await fixture.owner.from('fabric_stock_lots')
        .select('available_meters, available_taka_count').eq('id', lot.data.id).single()
    const movements = await fixture.owner.from('fabric_stock_movements')
        .select('movement_type, meters_delta').eq('org_id', fixture.orgId).eq('stock_lot_id', lot.data.id)
    assertCondition(assertions, 'concurrent sale and adjustment serialize to one successful mutation', successCount === 1, {
        sale_error: sale.error?.message ?? null,
        adjustment_error: adjustment.error?.message ?? null,
    })
    assertCondition(assertions, 'concurrent lot never becomes negative or double-used',
        numberValue(snapshot.data?.available_meters) >= 0
        && [0, 20].some((value) => near(snapshot.data?.available_meters, value))
        && movements.data?.length === 1, {
            lot: snapshot.data,
            movements: movements.data,
        })
}

async function proveManyRunFreshness(admin, fixture, partyId, assertions) {
    const runRows = Array.from({ length: 25 }, (_, index) => ({
        org_id: fixture.orgId,
        fabric_label: `B12 Scale Run ${String(index + 1).padStart(2, '0')}`,
        quality_label: 'B12 Scale Quality',
        target_meters: 10,
        cost_per_meter: 20,
        status: 'production',
    }))
    const runs = await admin.from('market_runs').insert(runRows).select('id')
    if (runs.error || runs.data?.length !== 25) throw new Error(`scale runs failed: ${runs.error?.message}`)
    const lots = await admin.from('fabric_stock_lots').insert(runs.data.map((run) => lotRow(fixture.orgId, {
        quality_label: 'B12 Scale Quality', source_type: 'market_run', market_run_id: run.id,
        original_taka_count: 1, available_taka_count: 0.5, meters_per_taka: 10,
        original_meters: 10, available_meters: 5, stock_purpose: 'sellable', created_by: fixture.ownerUserId,
    }))).select('id, market_run_id')
    if (lots.error || lots.data?.length !== 25) throw new Error(`scale lots failed: ${lots.error?.message}`)
    const sales = await admin.from('fabric_stock_sales').insert(lots.data.map((lot, index) => ({
        org_id: fixture.orgId, stock_lot_id: lot.id, sale_date: todayDate(), taka_sold: 0.5,
        meters_sold: 5, price_per_meter: 40 + index, cost_per_meter: 20,
        party_id: partyId, party_name: 'B12 Duplicate Buyer', credit_days: 7,
        dispatch_status: 'not_dispatched', dispatched_meters: 0, pending_dispatch_meters: 5,
        notes: 'B12 scale sale', created_by: fixture.ownerUserId,
    }))).select('id')
    if (sales.error || sales.data?.length !== 25) throw new Error(`scale sales failed: ${sales.error?.message}`)

    const started = performance.now()
    const summary = await fixture.owner.from('market_run_summary').select('market_run_id, total_meters_sold, meters_in_godown, sales_count')
        .eq('org_id', fixture.orgId).order('created_at', { ascending: false })
    const elapsedMs = Math.round((performance.now() - started) * 10) / 10
    if (summary.error) throw new Error(`scale summary failed: ${summary.error.message}`)
    assertCondition(assertions, 'many-run market summary loads within the formal budget',
        summary.data.length >= 26 && elapsedMs < 2000, { rows: summary.data.length, elapsed_ms: elapsedMs })

    const targetLot = lots.data[0]
    const update = await admin.from('fabric_stock_lots').update({ available_meters: 4, available_taka_count: 0.4 })
        .eq('id', targetLot.id)
    if (update.error) throw new Error(`scale mutation lot failed: ${update.error.message}`)
    const extraSale = await admin.from('fabric_stock_sales').insert({
        org_id: fixture.orgId, stock_lot_id: targetLot.id, sale_date: todayDate(), taka_sold: 0.1,
        meters_sold: 1, price_per_meter: 50, cost_per_meter: 20, party_id: partyId,
        party_name: 'B12 Duplicate Buyer', credit_days: 7, dispatch_status: 'not_dispatched',
        dispatched_meters: 0, pending_dispatch_meters: 1, notes: 'B12 freshness mutation', created_by: fixture.ownerUserId,
    })
    if (extraSale.error) throw new Error(`scale mutation sale failed: ${extraSale.error.message}`)
    const fresh = await fixture.ownerSecond.from('market_run_summary')
        .select('total_meters_sold, meters_in_godown, sales_count').eq('market_run_id', targetLot.market_run_id).single()
    assertCondition(assertions, 'second session sees fresh market summary after mutation',
        near(fresh.data?.total_meters_sold, 6) && near(fresh.data?.meters_in_godown, 4)
        && Number(fresh.data?.sales_count) === 2, fresh.data)
    return { rows: summary.data.length, elapsedMs }
}

async function main() {
    const envFile = productionMode ? '.env.production.local' : '.env.qa.local'
    const env = { ...process.env, ...parseEnv(await fs.readFile(path.join(workspace, envFile), 'utf8')) }
    if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(projectRef)) throw new Error(`B12 refused: ${environment} project target was not proven.`)
    if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error(`B12 ${environment} keys are missing.`)
    const admin = clientFor(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const assertions = []
    const evidence = {
        run_id: `B12-${environment.toUpperCase()}-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`,
        scope: 'B12 market, stock, dispatch, compliance, concurrency, and party identity runtime proof',
        environment,
        project_ref: projectRef,
        deployment: productionMode ? {
            id: deploymentId,
            commit: deploymentCommit,
            state: 'READY',
            target: 'production',
            alias: 'https://textile-accounting.vercel.app',
        } : null,
        closure_targets: closureTargets,
        assertions,
        cleanup: 'pending',
    }
    const outputName = productionMode ? 'B12-production-market-stock.json' : 'B12-qa-market-stock.json'
    const outputPath = path.join(workspace, 'output/qa/blocked-row-campaign', outputName)
    let fixture = null
    try {
        fixture = await createFixture(admin, env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        evidence.disposable_tenants = [safeId(fixture.orgId), safeId(fixture.adversaryOrgId)]
        await seedSourceValidation(admin, fixture, assertions)
        const setup = await seedMainMarket(admin, fixture)
        evidence.ids = { market_run_id: safeId(setup.marketRunId), order_id: safeId(setup.orderId), stock_lot_id: safeId(setup.lotId) }
        const mainSale = await proveMarketClosure(admin, fixture, setup, assertions)
        evidence.market_lifecycle = {
            sale_id: safeId(mainSale.saleId),
            party_id: safeId(mainSale.partyId),
            dispatch_ids: mainSale.dispatchIds.map(safeId),
        }
        const duplicate = await proveDuplicatePartyIdentity(admin, fixture, mainSale, assertions)
        evidence.party_identity = { second_sale_id: safeId(duplicate.secondSaleId), second_party_id: safeId(duplicate.secondPartyId) }
        await proveConcurrentLotMutation(fixture, assertions)
        evidence.scale = await proveManyRunFreshness(admin, fixture, mainSale.partyId, assertions)
        evidence.passed = assertions.every((item) => item.passed)
        await fs.mkdir(path.dirname(outputPath), { recursive: true })
        await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
        const cleanupResult = await cleanup(admin, fixture)
        fixture = null
        evidence.cleanup = cleanupResult.reconciled ? 'complete' : 'failed'
        evidence.cleanup_result = cleanupResult
        evidence.passed = evidence.passed && cleanupResult.reconciled
        await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
        process.stdout.write(`${JSON.stringify({ path: outputPath, passed: evidence.passed, assertions: assertions.length, cleanup: evidence.cleanup }, null, 2)}\n`)
        if (!evidence.passed) process.exitCode = 1
    } catch (error) {
        const cleanupResult = fixture ? await cleanup(admin, fixture) : null
        evidence.passed = false
        evidence.error = String(error?.message ?? error)
        evidence.cleanup = cleanupResult?.reconciled ? 'complete_after_failure' : 'failed_after_failure'
        evidence.cleanup_result = cleanupResult
        await fs.mkdir(path.dirname(outputPath), { recursive: true })
        await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
        throw error
    }
}

await main()
