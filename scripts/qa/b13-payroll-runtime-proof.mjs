#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const workspace = process.cwd()
const QA_REF = 'eutycrtzzxmlkcpipgod'
const cycleStart = '2026-06-01'
const preserveFixture = process.argv.includes('--preserve')
const cleanupOnly = process.argv.includes('--cleanup-secret')
const secretPath = path.join(workspace, '.codex', 'b13-runtime-secret.json')

function parseEnv(contents) {
    return Object.fromEntries(contents.split(/\r?\n/).flatMap((raw) => {
        const line = raw.trim()
        if (!line || line.startsWith('#') || !line.includes('=')) return []
        const separator = line.indexOf('=')
        let value = line.slice(separator + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
        return [[line.slice(0, separator), value]]
    }))
}

function clientFor(url, key) {
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function safeId(value) {
    return typeof value === 'string' ? `${value.slice(0, 8)}...${value.slice(-4)}` : value
}

function todayDate() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
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

async function createFixture(admin, url, anonKey) {
    const suffix = crypto.randomBytes(5).toString('hex')
    const email = `b13-owner-${suffix}@qa.weavly.local`
    const password = `B13-${suffix}-${crypto.randomBytes(8).toString('hex')}!`
    const auth = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'B13 Owner' } })
    if (auth.error || !auth.data.user) throw new Error(`create auth user failed: ${auth.error?.message}`)
    const supervisorEmail = `b13-supervisor-${suffix}@qa.weavly.local`
    const supervisorPassword = `B13-supervisor-${suffix}-${crypto.randomBytes(8).toString('hex')}!`
    const supervisorAuth = await admin.auth.admin.createUser({
        email: supervisorEmail, password: supervisorPassword, email_confirm: true,
        user_metadata: { full_name: 'B13 Supervisor' },
    })
    if (supervisorAuth.error || !supervisorAuth.data.user) throw new Error(`create supervisor auth user failed: ${supervisorAuth.error?.message}`)
    const org = await admin.from('organizations').insert({
        name: `B13 Payroll ${suffix}`,
        owner_id: auth.data.user.id,
        join_code: `B13${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        join_code_expires_at: new Date(Date.now() + 3600000).toISOString(),
        onboarding_complete: true,
        production_mode: 'both',
    }).select('id').single()
    if (org.error || !org.data) throw new Error(`create org failed: ${org.error?.message}`)
    const profile = await admin.from('profiles').insert({ id: auth.data.user.id, org_id: org.data.id, role: 'owner', full_name: 'B13 Owner', email })
    if (profile.error) throw new Error(`create profile failed: ${profile.error.message}`)
    const supervisorProfile = await admin.from('profiles').insert({
        id: supervisorAuth.data.user.id, org_id: org.data.id, role: 'supervisor',
        full_name: 'B13 Supervisor', email: supervisorEmail,
    })
    if (supervisorProfile.error) throw new Error(`create supervisor profile failed: ${supervisorProfile.error.message}`)
    const subscription = await admin.from('org_subscriptions').insert({
        org_id: org.data.id, plan_id: 'trial', plan_tier: 'premium', status: 'active',
        current_end: new Date(Date.now() + 86400000).toISOString(),
    })
    if (subscription.error) throw new Error(`create subscription failed: ${subscription.error.message}`)
    const signIn = async () => {
        const client = clientFor(url, anonKey)
        const result = await client.auth.signInWithPassword({ email, password })
        if (result.error) throw new Error(`owner sign-in failed: ${result.error.message}`)
        return client
    }
    const supervisor = clientFor(url, anonKey)
    const supervisorSignIn = await supervisor.auth.signInWithPassword({ email: supervisorEmail, password: supervisorPassword })
    if (supervisorSignIn.error) throw new Error(`supervisor sign-in failed: ${supervisorSignIn.error.message}`)
    return {
        orgId: org.data.id,
        ownerUserId: auth.data.user.id,
        authUserId: auth.data.user.id,
        supervisorUserId: supervisorAuth.data.user.id,
        owner: await signIn(),
        ownerSecond: await signIn(),
        supervisor,
        ownerEmail: email,
        ownerPassword: password,
        supervisorEmail,
        supervisorPassword,
    }
}

async function cleanup(admin, fixture) {
    if (!fixture) return { reconciled: false, errors: ['fixture unavailable'] }
    const errors = []
    const tables = [
        'supervisor_float_transactions', 'payroll_adjustments', 'payroll_settlements', 'worker_advances',
        'fabric_stock_movements', 'fabric_stock_lots', 'production_logs', 'shift_assignments',
        'machine_operator_assignments', 'machine_assignments', 'machines', 'workers', 'orders', 'market_runs',
        'payroll_configs', 'org_subscriptions', 'audit_log',
    ]
    for (const table of tables) {
        const result = await admin.from(table).delete().eq('org_id', fixture.orgId)
        if (result.error) errors.push(`${table}: ${result.error.message}`)
    }
    const userIds = [fixture.ownerUserId, fixture.supervisorUserId]
    const profile = await admin.from('profiles').delete().in('id', userIds)
    if (profile.error) errors.push(`profiles: ${profile.error.message}`)
    const org = await admin.from('organizations').delete().eq('id', fixture.orgId)
    if (org.error) errors.push(`organizations: ${org.error.message}`)
    for (const userId of userIds) {
        const auth = await admin.auth.admin.deleteUser(userId)
        if (auth.error && auth.error.code !== 'user_not_found') errors.push(`auth ${safeId(userId)}: ${auth.error.message}`)
    }
    const [orgCount, profileCount, settlementCount, ownerAuthRead, supervisorAuthRead] = await Promise.all([
        admin.from('organizations').select('id', { count: 'exact', head: true }).eq('id', fixture.orgId),
        admin.from('profiles').select('id', { count: 'exact', head: true }).in('id', userIds),
        admin.from('payroll_settlements').select('id', { count: 'exact', head: true }).eq('org_id', fixture.orgId),
        admin.auth.admin.getUserById(fixture.authUserId),
        admin.auth.admin.getUserById(fixture.supervisorUserId),
    ])
    const reconciliation = {
        organizations: orgCount.count,
        profiles: profileCount.count,
        settlements: settlementCount.count,
        auth_users_exist: [ownerAuthRead, supervisorAuthRead].filter((row) => Boolean(row.data.user)).length,
    }
    return { errors, reconciliation, reconciled: errors.length === 0 && Object.values(reconciliation).every((value) => value === 0) }
}

async function seedPayrollGrain(admin, fixture) {
    const worker = await admin.from('workers').insert({
        org_id: fixture.orgId, name: 'B13 Concurrent Worker', is_active: true,
        date_of_birth: '1990-01-01', age_verification_method: 'government_id',
        age_verification_reference: `b13-${crypto.randomUUID()}`,
        age_verified_at: new Date().toISOString(), age_verified_by: fixture.ownerUserId,
    }).select('id').single()
    if (worker.error || !worker.data) throw new Error(`worker failed: ${worker.error?.message}`)
    const order = await admin.from('orders').insert({
        org_id: fixture.orgId, party_name: 'B13 Payroll Order', quality_label: 'B13 Payroll Quality',
        warp_instruction: '', weft_instruction: '', total_target_meters: 1000,
        start_date: cycleStart, deadline: '2026-06-30', status: 'active', tracking_token: `B13-${crypto.randomUUID()}`,
    }).select('id').single()
    if (order.error || !order.data) throw new Error(`order failed: ${order.error?.message}`)
    const machine = await admin.from('machines').insert({ org_id: fixture.orgId, name: 'B13 Payroll Loom', status: 'inactive', loom_type: 'rapier' }).select('id').single()
    if (machine.error || !machine.data) throw new Error(`machine failed: ${machine.error?.message}`)
    const standing = await admin.from('machine_assignments').insert([
        { org_id: fixture.orgId, machine_id: machine.data.id, worker_id: worker.data.id, shift: 'day' },
        { org_id: fixture.orgId, machine_id: machine.data.id, worker_id: worker.data.id, shift: 'night' },
    ])
    if (standing.error) throw new Error(`standing assignments failed: ${standing.error.message}`)
    const operator = await admin.from('machine_operator_assignments').insert({
        org_id: fixture.orgId, worker_type: 'meter_worker', meter_worker_id: worker.data.id,
        fixed_worker_id: null, machine_id: machine.data.id, machine_type: 'rapier', shift: 'day',
        pay_mode: 'per_meter', rate: 10, effective_from: cycleStart, is_primary_operator: true, active: true,
    }).select('id').single()
    if (operator.error || !operator.data) throw new Error(`operator assignment failed: ${operator.error?.message}`)
    const activate = await admin.from('machines').update({ status: 'active', current_order_id: order.data.id }).eq('id', machine.data.id)
    if (activate.error) throw new Error(`activate machine failed: ${activate.error.message}`)
    const log = await admin.from('production_logs').insert({
        org_id: fixture.orgId, worker_id: worker.data.id, meter_worker_id: worker.data.id,
        fixed_worker_id: null, machine_id: machine.data.id, order_id: order.data.id,
        meters: 100, date: '2026-06-10', shift: 'day', worker_rate_snapshot: 10,
        operator_assignment_id: operator.data.id, operator_worker_type: 'meter_worker',
        operator_pay_mode_snapshot: 'per_meter', operator_rate_snapshot: 10,
        machine_type_snapshot: 'rapier', created_by: fixture.ownerUserId, client_ip: 'b13-runtime',
    })
    if (log.error) throw new Error(`production log failed: ${log.error.message}`)
    const advance = await admin.from('worker_advances').insert({
        org_id: fixture.orgId, meter_worker_id: worker.data.id, amount: 800,
        description: 'B13 concurrent advance', status: 'pending', cycle_start_date: cycleStart,
    }).select('id').single()
    if (advance.error || !advance.data) throw new Error(`advance failed: ${advance.error?.message}`)
    return { workerId: worker.data.id, advanceId: advance.data.id }
}

async function settle(client, fixture, workerId, key) {
    return client.rpc('settle_worker_payroll_hardened', {
        p_org_id: fixture.orgId,
        p_worker_type: 'meter',
        p_worker_id: workerId,
        p_cycle_start: cycleStart,
        p_gross_amount: key === 'a' ? 1 : 999999,
        p_is_final_settlement: false,
        p_manual_deduction_override: null,
        p_actor_id: fixture.ownerUserId,
        p_payment_mode: 'cash',
        p_manual_adjustments: [],
        p_verified_by_owner: true,
    })
}

async function createWorker(admin, fixture, name) {
    const worker = await admin.from('workers').insert({
        org_id: fixture.orgId, name, is_active: true,
        date_of_birth: '1990-01-01', age_verification_method: 'government_id',
        age_verification_reference: `b13-${crypto.randomUUID()}`,
        age_verified_at: new Date().toISOString(), age_verified_by: fixture.ownerUserId,
    }).select('id').single()
    if (worker.error || !worker.data) throw new Error(`create ${name} failed: ${worker.error?.message}`)
    return worker.data.id
}

async function createProductionGrain(admin, fixture, workerId, options) {
    let marketRunId = null
    if (options.market) {
        const run = await admin.from('market_runs').insert({
            org_id: fixture.orgId, fabric_label: `${options.label} Fabric`, quality_label: `${options.label} Quality`,
            target_meters: 1000, cost_per_meter: 20, worker_rate_per_m: options.rate, status: 'production',
        }).select('id').single()
        if (run.error || !run.data) throw new Error(`create ${options.label} market run failed: ${run.error?.message}`)
        marketRunId = run.data.id
    }
    const order = await admin.from('orders').insert({
        org_id: fixture.orgId, party_name: `${options.label} Party`, quality_label: `${options.label} Quality`,
        warp_instruction: '', weft_instruction: '', total_target_meters: 1000,
        start_date: cycleStart, deadline: '2026-07-31', status: 'active',
        tracking_token: `B13-${crypto.randomUUID()}`, market_run_id: marketRunId,
    }).select('id').single()
    if (order.error || !order.data) throw new Error(`create ${options.label} order failed: ${order.error?.message}`)
    const machine = await admin.from('machines').insert({
        org_id: fixture.orgId, name: `${options.label} Loom`, status: 'inactive', loom_type: 'rapier',
    }).select('id').single()
    if (machine.error || !machine.data) throw new Error(`create ${options.label} machine failed: ${machine.error?.message}`)
    const standing = await admin.from('machine_assignments').insert([
        { org_id: fixture.orgId, machine_id: machine.data.id, worker_id: workerId, shift: 'day' },
        { org_id: fixture.orgId, machine_id: machine.data.id, worker_id: workerId, shift: 'night' },
    ])
    if (standing.error) throw new Error(`create ${options.label} standing assignments failed: ${standing.error.message}`)
    const operator = await admin.from('machine_operator_assignments').insert({
        org_id: fixture.orgId, worker_type: 'meter_worker', meter_worker_id: workerId,
        fixed_worker_id: null, machine_id: machine.data.id, machine_type: 'rapier', shift: 'day',
        pay_mode: 'per_meter', rate: options.rate, effective_from: cycleStart,
        is_primary_operator: true, active: true,
    }).select('id').single()
    if (operator.error || !operator.data) throw new Error(`create ${options.label} operator failed: ${operator.error?.message}`)
    const activate = await admin.from('machines').update({ status: 'active', current_order_id: order.data.id }).eq('id', machine.data.id)
    if (activate.error) throw new Error(`activate ${options.label} machine failed: ${activate.error.message}`)
    const insertLog = async (date, meters, rate) => {
        const log = await admin.from('production_logs').insert({
            org_id: fixture.orgId, worker_id: workerId, meter_worker_id: workerId,
            fixed_worker_id: null, machine_id: machine.data.id, order_id: order.data.id,
            meters, date, shift: 'day', worker_rate_snapshot: rate,
            operator_assignment_id: operator.data.id, operator_worker_type: 'meter_worker',
            operator_pay_mode_snapshot: 'per_meter', operator_rate_snapshot: rate,
            machine_type_snapshot: 'rapier', created_by: fixture.ownerUserId, client_ip: 'b13-runtime',
        }).select('id').single()
        if (log.error || !log.data) throw new Error(`create ${options.label} production failed: ${log.error?.message}`)
        return log.data.id
    }
    const logId = await insertLog(options.date, options.meters, options.rate)
    return { orderId: order.data.id, marketRunId, machineId: machine.data.id, operatorId: operator.data.id, logId, insertLog }
}

async function settlePayroll(client, fixture, workerId, overrides = {}) {
    const rpc = overrides.exit ? 'settle_exiting_worker_payroll_hardened' : 'settle_worker_payroll_hardened'
    return client.rpc(rpc, {
        p_org_id: fixture.orgId,
        p_worker_type: 'meter',
        p_worker_id: workerId,
        p_cycle_start: cycleStart,
        p_gross_amount: overrides.clientGross ?? 0,
        p_is_final_settlement: overrides.final ?? false,
        p_manual_deduction_override: overrides.manualDeduction ?? null,
        p_actor_id: fixture.ownerUserId,
        p_payment_mode: overrides.paymentMode ?? 'cash',
        p_manual_adjustments: overrides.adjustments ?? [],
        p_verified_by_owner: true,
    })
}

async function reverseConcurrentSettlement(admin, fixture, workerId, assertions) {
    const code = 'B13RV1'
    const hash = crypto.createHash('sha256').update(code).digest('hex')
    const codeUpdate = await admin.from('organizations').update({
        access_code_hash: hash,
        access_code_expires_at: new Date(Date.now() + 3600000).toISOString(),
        last_code_plain: null,
    }).eq('id', fixture.orgId)
    if (codeUpdate.error) throw new Error(`prepare reversal code failed: ${codeUpdate.error.message}`)
    const reversal = await fixture.owner.rpc('unsettle_worker_payroll_hardened', {
        p_org_id: fixture.orgId, p_worker_type: 'meter', p_worker_id: workerId,
        p_month: '2026-06', p_actor_id: fixture.ownerUserId, p_access_code: code,
    })
    if (reversal.error) throw new Error(`reverse settlement failed: ${reversal.error.message}`)
    const [settlements, advances, organization] = await Promise.all([
        admin.from('payroll_settlements').select('id', { count: 'exact', head: true }).eq('org_id', fixture.orgId).eq('meter_worker_id', workerId),
        admin.from('worker_advances').select('id, amount, status, settlement_id, origin_settlement_id').eq('org_id', fixture.orgId).eq('meter_worker_id', workerId),
        admin.from('organizations').select('access_code_hash, access_code_expires_at, last_code_plain').eq('id', fixture.orgId).single(),
    ])
    assertCondition(assertions, 'payroll reversal restores exact prior debt and consumes authorization',
        settlements.count === 0 && advances.data?.length === 1 && near(advances.data[0].amount, 800)
        && advances.data[0].status === 'pending' && !advances.data[0].settlement_id
        && !advances.data[0].origin_settlement_id && !organization.data?.access_code_hash
        && !organization.data?.access_code_expires_at && !organization.data?.last_code_plain, {
            settlement_count: settlements.count,
            advances: advances.data,
            reverted_advances: reversal.data?.reverted_advances,
        })
}

async function proveHistoricalAdjustments(admin, fixture, assertions) {
    const workerId = await createWorker(admin, fixture, 'B13 Historical Worker')
    const orderGrain = await createProductionGrain(admin, fixture, workerId, {
        label: 'B13 Golden A', date: '2026-06-08', meters: 100, rate: 2.75, market: false,
    })
    const rateUpdate = await admin.from('machine_operator_assignments').update({ rate: 3.125 }).eq('id', orderGrain.operatorId)
    if (rateUpdate.error) throw new Error(`update decimal operator rate failed: ${rateUpdate.error.message}`)
    const secondLogId = await orderGrain.insertLog('2026-06-12', 80, 3.125)
    const marketGrain = await createProductionGrain(admin, fixture, workerId, {
        label: 'B13 Golden B', date: '2026-06-18', meters: 50, rate: 3, market: true,
    })
    const advance = await admin.from('worker_advances').insert({
        org_id: fixture.orgId, meter_worker_id: workerId, amount: 500,
        description: 'B13 Golden payroll advance', status: 'pending', cycle_start_date: cycleStart,
    })
    if (advance.error) throw new Error(`create historical advance failed: ${advance.error.message}`)
    const adjustments = [
        { adjustment_type: 'inam', reason: 'Extra work', amount: 100, note: 'B13 documented extra work' },
        { adjustment_type: 'kapaat', reason: 'Quality issue', amount: 25, note: 'B13 documented quality issue' },
    ]
    const settlement = await settlePayroll(fixture.owner, fixture, workerId, {
        clientGross: 999999, adjustments, paymentMode: 'upi',
    })
    if (settlement.error) throw new Error(`historical settlement failed: ${settlement.error.message}`)
    const [logs, assignment, paid, persistedAdjustments, pending] = await Promise.all([
        admin.from('production_logs').select('id, order_id, operator_rate_snapshot, meters').eq('org_id', fixture.orgId).eq('meter_worker_id', workerId).order('date'),
        admin.from('machine_operator_assignments').select('rate').eq('id', orderGrain.operatorId).single(),
        admin.from('payroll_settlements').select('*').eq('org_id', fixture.orgId).eq('meter_worker_id', workerId).single(),
        admin.from('payroll_adjustments').select('adjustment_type, reason, amount, note, settlement_id').eq('org_id', fixture.orgId).eq('meter_worker_id', workerId).order('amount', { ascending: false }),
        admin.from('worker_advances').select('amount, status, settlement_id, origin_settlement_id').eq('org_id', fixture.orgId).eq('meter_worker_id', workerId).eq('status', 'pending'),
    ])
    assertCondition(assertions, 'decimal operator rate persists and historical production keeps each snapshot',
        near(assignment.data?.rate, 3.125) && logs.data?.length === 3
        && near(logs.data[0].operator_rate_snapshot, 2.75)
        && near(logs.data[1].operator_rate_snapshot, 3.125)
        && near(logs.data[2].operator_rate_snapshot, 3), {
            current_rate: numberValue(assignment.data?.rate),
            snapshots: logs.data?.map((row) => numberValue(row.operator_rate_snapshot)),
        })
    assertCondition(assertions, 'server payroll ignores client gross and uses order plus market production snapshots',
        near(paid.data?.gross_pay, 675) && settlement.data?.client_gross_ignored === true
        && near(settlement.data?.server_calculated_gross, 675)
        && new Set(logs.data?.map((row) => row.order_id)).size === 2
        && logs.data?.some((row) => row.id === secondLogId)
        && marketGrain.marketRunId !== null, {
            gross_pay: numberValue(paid.data?.gross_pay),
            server_gross: numberValue(settlement.data?.server_calculated_gross),
            order_count: new Set(logs.data?.map((row) => row.order_id)).size,
        })
    assertCondition(assertions, 'inam and kapaat are itemized with reasons and never produce a negative payout',
        persistedAdjustments.data?.length === 2
        && persistedAdjustments.data.every((row) => row.reason && row.note && row.settlement_id === paid.data?.id)
        && near(paid.data?.net_payout, 375) && near(paid.data?.advance_deducted, 375)
        && near(paid.data?.carried_forward_debt, 125)
        && near(paid.data?.itemization_payload?.inamTotal, 100)
        && near(paid.data?.itemization_payload?.kapaatTotal, 25)
        && pending.data?.length === 1 && near(pending.data[0].amount, 125), {
            settlement: {
                gross: numberValue(paid.data?.gross_pay),
                net: numberValue(paid.data?.net_payout),
                advance: numberValue(paid.data?.advance_deducted),
                debt: numberValue(paid.data?.carried_forward_debt),
            },
            adjustments: persistedAdjustments.data,
            pending: pending.data,
        })
    assertCondition(assertions, 'Golden A and Golden B payroll share one immutable production-backed payslip',
        paid.data?.status === 'paid' && paid.data?.payment_mode === 'upi'
        && paid.data?.itemization_payload?.verifiedByOwner === true
        && logs.data?.some((row) => row.order_id === orderGrain.orderId)
        && logs.data?.some((row) => row.order_id === marketGrain.orderId), {
            settlement_id: paid.data?.id,
            payment_mode: paid.data?.payment_mode,
            order_id: safeId(orderGrain.orderId),
            market_order_id: safeId(marketGrain.orderId),
        })
}

async function proveFinalExit(admin, fixture, assertions) {
    const workerId = await createWorker(admin, fixture, 'B13 Exiting Worker')
    await createProductionGrain(admin, fixture, workerId, {
        label: 'B13 Final Exit', date: '2026-06-14', meters: 40, rate: 10, market: false,
    })
    const advance = await admin.from('worker_advances').insert({
        org_id: fixture.orgId, meter_worker_id: workerId, amount: 600,
        description: 'B13 final settlement debt', status: 'pending', cycle_start_date: cycleStart,
    })
    if (advance.error) throw new Error(`create final advance failed: ${advance.error.message}`)
    const result = await settlePayroll(fixture.owner, fixture, workerId, { final: true, exit: true, clientGross: 1 })
    if (result.error) throw new Error(`final exit settlement failed: ${result.error.message}`)
    const [worker, paid, pending] = await Promise.all([
        admin.from('workers').select('is_active').eq('id', workerId).single(),
        admin.from('payroll_settlements').select('gross_pay, advance_deducted, net_payout, carried_forward_debt, is_final_settlement').eq('org_id', fixture.orgId).eq('meter_worker_id', workerId).single(),
        admin.from('worker_advances').select('amount, status').eq('org_id', fixture.orgId).eq('meter_worker_id', workerId).eq('status', 'pending'),
    ])
    assertCondition(assertions, 'final exit settlement deactivates the worker atomically and preserves explicit remaining debt',
        worker.data?.is_active === false && result.data?.worker_deactivated === true
        && paid.data?.is_final_settlement === true && near(paid.data?.gross_pay, 400)
        && near(paid.data?.advance_deducted, 400) && near(paid.data?.net_payout, 0)
        && near(paid.data?.carried_forward_debt, 200)
        && pending.data?.length === 1 && near(pending.data[0].amount, 200), {
            worker_active: worker.data?.is_active,
            settlement: paid.data,
            pending: pending.data,
        })
}

async function proveKharchi(admin, fixture, assertions) {
    const workerId = await createWorker(admin, fixture, 'B13 Kharchi Worker')
    const refill = await admin.from('supervisor_float_transactions').insert({
        org_id: fixture.orgId, supervisor_id: fixture.supervisorUserId, type: 'refill', amount: 500,
    })
    if (refill.error) throw new Error(`create supervisor float failed: ${refill.error.message}`)
    const result = await fixture.supervisor.rpc('record_supervisor_kharchi', {
        p_worker_type: 'meter', p_worker_id: workerId, p_amount: 120,
        p_description: 'B13 online supervisor kharchi',
    })
    if (result.error) throw new Error(`record kharchi failed: ${result.error.message}`)
    const [advances, transactions] = await Promise.all([
        admin.from('worker_advances').select('id, amount, status, type, cycle_start_date').eq('org_id', fixture.orgId).eq('meter_worker_id', workerId),
        admin.from('supervisor_float_transactions').select('type, amount, worker_advance_id').eq('org_id', fixture.orgId).eq('supervisor_id', fixture.supervisorUserId).order('created_at'),
    ])
    const balance = transactions.data?.reduce((total, row) => total + (row.type === 'refill' ? Number(row.amount) : -Number(row.amount)), 0)
    assertCondition(assertions, 'supervisor kharchi decreases float and creates one worker advance atomically',
        advances.data?.length === 1 && near(advances.data[0].amount, 120)
        && advances.data[0].status === 'pending' && advances.data[0].type === 'kharchi'
        && transactions.data?.length === 2 && transactions.data[1].worker_advance_id === advances.data[0].id
        && near(balance, 380) && near(result.data?.balance_after, 380), {
            advances: advances.data,
            transactions: transactions.data,
            balance,
        })
}

async function proveDashboardSource(admin, fixture, assertions) {
    const workerId = await createWorker(admin, fixture, 'B13 Today Worker')
    const grain = await createProductionGrain(admin, fixture, workerId, {
        label: 'B13 Today Dashboard', date: todayDate(), meters: 50, rate: 4, market: false,
    })
    const [logs, order] = await Promise.all([
        admin.from('production_logs').select('id, meters, operator_rate_snapshot, order_id, machine_id').eq('org_id', fixture.orgId).eq('date', todayDate()).eq('id', grain.logId),
        admin.from('orders').select('id, total_target_meters, status').eq('id', grain.orderId).single(),
    ])
    assertCondition(assertions, 'after-shift dashboard source contains one production and wage signal',
        logs.data?.length === 1 && near(logs.data[0].meters, 50)
        && near(logs.data[0].operator_rate_snapshot, 4)
        && logs.data[0].order_id === grain.orderId && order.data?.status === 'active', {
            date: todayDate(),
            meters: numberValue(logs.data?.[0]?.meters),
            rate: numberValue(logs.data?.[0]?.operator_rate_snapshot),
            wage_signal: numberValue(logs.data?.[0]?.meters) * numberValue(logs.data?.[0]?.operator_rate_snapshot),
            order_id: safeId(grain.orderId),
        })
    return {
        worker_id: workerId,
        order_id: safeId(grain.orderId),
        machine_id: safeId(grain.machineId),
        operator_assignment_id: safeId(grain.operatorId),
        production_log_id: grain.logId,
    }
}

async function main() {
    const env = { ...process.env, ...parseEnv(await fs.readFile(path.join(workspace, '.env.qa.local'), 'utf8')) }
    if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(QA_REF)) throw new Error('B13 refused: QA project target was not proven.')
    const admin = clientFor(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    if (cleanupOnly) {
        const stored = JSON.parse(await fs.readFile(secretPath, 'utf8'))
        const cleanupResult = await cleanup(admin, stored.fixture)
        if (cleanupResult.reconciled) await fs.rm(secretPath, { force: true })
        process.stdout.write(`${JSON.stringify({ cleanup: cleanupResult, secret_removed: cleanupResult.reconciled }, null, 2)}\n`)
        if (!cleanupResult.reconciled) process.exitCode = 1
        return
    }
    const outputPath = path.join(workspace, 'output/qa/blocked-row-campaign/B13-boundary-probe.json')
    const assertions = []
    const evidence = {
        run_id: `B13-QA-${Date.now()}`,
        scope: 'B13 payroll, advances, adjustments, reversal, exit, kharchi, and Golden payroll runtime proof',
        environment: 'qa', project_ref: QA_REF, assertions, observations: {}, cleanup: 'pending',
    }
    let fixture = null
    try {
        fixture = await createFixture(admin, env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        evidence.disposable_tenant = safeId(fixture.orgId)
        const grain = await seedPayrollGrain(admin, fixture)
        const [first, second] = await Promise.all([
            settle(fixture.owner, fixture, grain.workerId, 'a'),
            settle(fixture.ownerSecond, fixture, grain.workerId, 'b'),
        ])
        const [settlements, advances] = await Promise.all([
            admin.from('payroll_settlements').select('id, gross_pay, advance_deducted, net_payout, carried_forward_debt, itemization_payload').eq('org_id', fixture.orgId),
            admin.from('worker_advances').select('id, amount, status, settlement_id, origin_settlement_id').eq('org_id', fixture.orgId).order('id'),
        ])
        const deleteAttempt = await fixture.owner.from('worker_advances').delete().eq('id', grain.advanceId).select('id')
        evidence.observations = {
            concurrent_rpc_successes: [first, second].filter((result) => !result.error).length,
            concurrent_rpc_errors: [first.error?.message ?? null, second.error?.message ?? null],
            settlements: settlements.data,
            advances_before_delete: advances.data,
            deducted_advance_delete_error: deleteAttempt.error?.message ?? null,
            deducted_advance_deleted_rows: deleteAttempt.data?.length ?? 0,
        }
        evidence.defects_reproduced = {
            concurrent_double_success: evidence.observations.concurrent_rpc_successes !== 1,
            deducted_advance_direct_delete: evidence.observations.deducted_advance_deleted_rows !== 0,
        }
        assertCondition(assertions, 'concurrent settlement creates one settlement and deducts advances once',
            evidence.observations.concurrent_rpc_successes === 1
            && settlements.data?.length === 1
            && near(settlements.data[0].gross_pay, 1000)
            && near(settlements.data[0].advance_deducted, 500)
            && near(settlements.data[0].net_payout, 500)
            && near(settlements.data[0].carried_forward_debt, 300)
            && advances.data?.length === 2
            && advances.data.filter((row) => row.status === 'deducted').length === 1
            && advances.data.filter((row) => row.status === 'pending').length === 1, evidence.observations)
        assertCondition(assertions, 'standard advance recovery cap is exactly fifty percent with explicit carry-forward',
            near(settlements.data?.[0]?.gross_pay, 1000)
            && near(settlements.data?.[0]?.advance_deducted, 500)
            && near(settlements.data?.[0]?.carried_forward_debt, 300), {
                gross_pay: numberValue(settlements.data?.[0]?.gross_pay),
                advance_deducted: numberValue(settlements.data?.[0]?.advance_deducted),
                carried_forward_debt: numberValue(settlements.data?.[0]?.carried_forward_debt),
            })
        assertCondition(assertions, 'deducted advance deletion is blocked at the database boundary',
            Boolean(deleteAttempt.error) && (deleteAttempt.data?.length ?? 0) === 0, {
                error: deleteAttempt.error?.message,
                deleted_rows: deleteAttempt.data?.length ?? 0,
            })
        await reverseConcurrentSettlement(admin, fixture, grain.workerId, assertions)
        await proveHistoricalAdjustments(admin, fixture, assertions)
        await proveFinalExit(admin, fixture, assertions)
        await proveKharchi(admin, fixture, assertions)
        evidence.dashboard_fixture = await proveDashboardSource(admin, fixture, assertions)
        evidence.passed = assertions.every((item) => item.passed)
        await fs.mkdir(path.dirname(outputPath), { recursive: true })
        if (preserveFixture) {
            await fs.mkdir(path.dirname(secretPath), { recursive: true })
            await fs.writeFile(secretPath, `${JSON.stringify({
                fixture: {
                    orgId: fixture.orgId,
                    ownerUserId: fixture.ownerUserId,
                    authUserId: fixture.authUserId,
                    supervisorUserId: fixture.supervisorUserId,
                },
                owner: { email: fixture.ownerEmail, password: fixture.ownerPassword },
                supervisor: { email: fixture.supervisorEmail, password: fixture.supervisorPassword },
            }, null, 2)}\n`, { mode: 0o600 })
            evidence.cleanup = 'pending_browser_proof'
            evidence.preserved_fixture = { org_id: safeId(fixture.orgId), secret_path: path.relative(workspace, secretPath) }
            await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
            process.stdout.write(`${JSON.stringify({ path: outputPath, passed: evidence.passed, assertions: assertions.length, cleanup: evidence.cleanup }, null, 2)}\n`)
            return
        }
        const cleanupResult = await cleanup(admin, fixture)
        fixture = null
        evidence.cleanup = cleanupResult.reconciled ? 'complete' : 'failed'
        evidence.cleanup_result = cleanupResult
        evidence.passed = evidence.passed && cleanupResult.reconciled
        await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
        process.stdout.write(`${JSON.stringify({ path: outputPath, passed: evidence.passed, assertions: assertions.length, regressions: evidence.defects_reproduced, cleanup: evidence.cleanup }, null, 2)}\n`)
        if (!evidence.passed) process.exitCode = 1
    } catch (error) {
        const cleanupResult = fixture ? await cleanup(admin, fixture) : null
        evidence.error = String(error?.message ?? error)
        evidence.passed = false
        evidence.cleanup = cleanupResult?.reconciled ? 'complete_after_failure' : 'failed_after_failure'
        evidence.cleanup_result = cleanupResult
        await fs.mkdir(path.dirname(outputPath), { recursive: true })
        await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
        throw error
    }
}

await main()
