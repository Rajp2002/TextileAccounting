#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { createClient } from '@supabase/supabase-js'

const workspace = process.cwd()
const QA_REF = 'eutycrtzzxmlkcpipgod'
const PROD_REF = 'vzhwahudircrpgtitwzd'
const productionMode = process.argv.includes('--production')
const environmentName = productionMode ? 'production' : 'qa'
const expectedProjectRef = productionMode ? PROD_REF : QA_REF
const preserveFixture = process.argv.includes('--preserve')
const cleanupOnly = process.argv.includes('--cleanup-secret')
const emitRealtime = process.argv.includes('--emit-realtime')
const emitReconnect = process.argv.includes('--emit-reconnect')
const secretPath = path.join(workspace, '.codex', `b14-${environmentName}-runtime-secret.json`)
const outputPath = path.join(workspace, `output/qa/blocked-row-campaign/B14-${environmentName}-dashboard.json`)
const envPath = path.join(workspace, productionMode ? '.env.production.local' : '.env.qa.local')

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

function suratToday() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
}

function addDays(dateOnly, days) {
    const date = new Date(`${dateOnly}T00:00:00.000Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
}

function assertCondition(assertions, name, passed, details = {}) {
    assertions.push({ name, passed, ...details })
    if (!passed) throw new Error(`${name} failed: ${JSON.stringify(details)}`)
}

async function createFixture(admin, url, anonKey) {
    const suffix = crypto.randomBytes(5).toString('hex')
    const email = `b14-owner-${suffix}@qa.weavly.local`
    const password = `B14-${suffix}-${crypto.randomBytes(8).toString('hex')}!`
    const auth = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: 'B14 Owner' },
    })
    if (auth.error || !auth.data.user) throw new Error(`create auth user failed: ${auth.error?.message}`)
    const org = await admin.from('organizations').insert({
        name: `B14 Dashboard ${suffix}`,
        owner_id: auth.data.user.id,
        join_code: `B14${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        join_code_expires_at: new Date(Date.now() + 3600000).toISOString(),
        onboarding_complete: true,
        production_mode: 'both',
    }).select('id').single()
    if (org.error || !org.data) throw new Error(`create org failed: ${org.error?.message}`)
    const profile = await admin.from('profiles').insert({
        id: auth.data.user.id, org_id: org.data.id, role: 'owner', full_name: 'B14 Owner', email,
    })
    if (profile.error) throw new Error(`create profile failed: ${profile.error.message}`)
    const subscription = await admin.from('org_subscriptions').insert({
        org_id: org.data.id, plan_id: 'trial', plan_tier: 'premium', status: 'active',
        current_end: new Date(Date.now() + 86400000).toISOString(),
    })
    if (subscription.error) throw new Error(`create subscription failed: ${subscription.error.message}`)
    const owner = clientFor(url, anonKey)
    const signIn = await owner.auth.signInWithPassword({ email, password })
    if (signIn.error) throw new Error(`owner sign-in failed: ${signIn.error.message}`)
    return {
        orgId: org.data.id,
        ownerUserId: auth.data.user.id,
        owner,
        email,
        password,
    }
}

async function cleanup(admin, fixture) {
    if (!fixture) return { reconciled: false, errors: ['fixture unavailable'] }
    const errors = []
    const tables = [
        'production_logs', 'shift_assignments', 'machine_operator_assignments', 'machine_assignments',
        'fabric_stock_movements', 'fabric_stock_lots', 'machines', 'workers', 'orders',
        'org_subscriptions', 'audit_log',
    ]
    for (const table of tables) {
        const result = await admin.from(table).delete().eq('org_id', fixture.orgId)
        if (result.error) errors.push(`${table}: ${result.error.message}`)
    }
    const profile = await admin.from('profiles').delete().eq('id', fixture.ownerUserId)
    if (profile.error) errors.push(`profiles: ${profile.error.message}`)
    const org = await admin.from('organizations').delete().eq('id', fixture.orgId)
    if (org.error) errors.push(`organizations: ${org.error.message}`)
    const auth = await admin.auth.admin.deleteUser(fixture.ownerUserId)
    if (auth.error && auth.error.code !== 'user_not_found') errors.push(`auth: ${auth.error.message}`)
    const [orgCount, profileCount, logCount, authRead] = await Promise.all([
        admin.from('organizations').select('id', { count: 'exact', head: true }).eq('id', fixture.orgId),
        admin.from('profiles').select('id', { count: 'exact', head: true }).eq('id', fixture.ownerUserId),
        admin.from('production_logs').select('id', { count: 'exact', head: true }).eq('org_id', fixture.orgId),
        admin.auth.admin.getUserById(fixture.ownerUserId),
    ])
    const reconciliation = {
        organizations: orgCount.count,
        profiles: profileCount.count,
        production_logs: logCount.count,
        auth_users_exist: authRead.data.user ? 1 : 0,
    }
    return {
        errors,
        reconciliation,
        reconciled: errors.length === 0 && Object.values(reconciliation).every((value) => value === 0),
    }
}

async function seedDashboard(admin, fixture) {
    const today = suratToday()
    const startDate = addDays(today, -89)
    const deadline = addDays(today, 5)
    const worker = await admin.from('workers').insert({
        org_id: fixture.orgId, name: 'B14 Dashboard Worker', is_active: true,
        date_of_birth: '1990-01-01', age_verification_method: 'government_id',
        age_verification_reference: `b14-${crypto.randomUUID()}`,
        age_verified_at: new Date().toISOString(), age_verified_by: fixture.ownerUserId,
    }).select('id').single()
    if (worker.error || !worker.data) throw new Error(`create worker failed: ${worker.error?.message}`)

    const orders = await admin.from('orders').insert([
        {
            org_id: fixture.orgId, party_name: 'B14 Large Range At Risk', quality_label: 'B14 Dashboard Quality',
            warp_instruction: '', weft_instruction: '', total_target_meters: 5000,
            start_date: startDate, deadline, status: 'active', tracking_token: `B14-${crypto.randomUUID()}`,
        },
        {
            org_id: fixture.orgId, party_name: 'B14 Waiting For Logs', quality_label: 'B14 Waiting Quality',
            warp_instruction: '', weft_instruction: '', total_target_meters: 1000,
            start_date: today, deadline: addDays(today, 10), status: 'active', tracking_token: `B14-${crypto.randomUUID()}`,
        },
    ]).select('id, party_name')
    if (orders.error || orders.data?.length !== 2) throw new Error(`create orders failed: ${orders.error?.message}`)
    const activeOrder = orders.data.find((row) => row.party_name === 'B14 Large Range At Risk')
    const waitingOrder = orders.data.find((row) => row.party_name === 'B14 Waiting For Logs')
    if (!activeOrder || !waitingOrder) throw new Error('seeded B14 orders were not returned')

    const machinePayload = Array.from({ length: 11 }, (_, index) => ({
        org_id: fixture.orgId,
        name: `B14 Loom ${String(index + 1).padStart(2, '0')}`,
        status: 'inactive',
        loom_type: 'rapier',
    }))
    const machines = await admin.from('machines').insert(machinePayload).select('id, name')
    if (machines.error || machines.data?.length !== 11) throw new Error(`create machines failed: ${machines.error?.message}`)

    const assignments = machines.data.flatMap((machine) => ['day', 'night'].map((shift) => ({
        org_id: fixture.orgId, machine_id: machine.id, worker_id: worker.data.id, shift,
    })))
    const standing = await admin.from('machine_assignments').insert(assignments)
    if (standing.error) throw new Error(`create standing assignments failed: ${standing.error.message}`)
    const operators = await admin.from('machine_operator_assignments').insert(machines.data.flatMap((machine) => ['day', 'night'].map((shift) => ({
        org_id: fixture.orgId, worker_type: 'meter_worker', meter_worker_id: worker.data.id,
        fixed_worker_id: null, machine_id: machine.id, machine_type: 'rapier', shift,
        pay_mode: 'per_meter', rate: 4, effective_from: startDate,
        is_primary_operator: true, active: true,
    })))).select('id, machine_id, shift')
    if (operators.error || operators.data?.length !== 22) throw new Error(`create operators failed: ${operators.error?.message}`)
    const activate = await admin.from('machines').update({ status: 'active', current_order_id: activeOrder.id }).eq('org_id', fixture.orgId)
    if (activate.error) throw new Error(`activate machines failed: ${activate.error.message}`)

    const operatorByGrain = new Map(operators.data.map((operator) => [`${operator.machine_id}:${operator.shift}`, operator.id]))
    const historicalMachines = machines.data.slice(0, 10)
    const logs = []
    for (let day = 0; day < 90; day += 1) {
        const date = addDays(startDate, day)
        for (const machine of historicalMachines) {
            for (const shift of ['day', 'night']) {
                logs.push({
                    org_id: fixture.orgId,
                    worker_id: worker.data.id,
                    meter_worker_id: worker.data.id,
                    fixed_worker_id: null,
                    machine_id: machine.id,
                    order_id: activeOrder.id,
                    meters: 1,
                    date,
                    shift,
                    worker_rate_snapshot: 4,
                    operator_assignment_id: operatorByGrain.get(`${machine.id}:${shift}`),
                    operator_worker_type: 'meter_worker',
                    operator_pay_mode_snapshot: 'per_meter',
                    operator_rate_snapshot: 4,
                    machine_type_snapshot: 'rapier',
                    created_by: fixture.ownerUserId,
                    client_ip: 'b14-runtime',
                })
            }
        }
    }
    for (let index = 0; index < logs.length; index += 100) {
        const insert = await admin.from('production_logs').insert(logs.slice(index, index + 100))
        if (insert.error) throw new Error(`bulk production insert ${index} failed: ${insert.error.message}`)
    }

    const eventMachine = machines.data[10]
    return {
        today,
        startDate,
        deadline,
        workerId: worker.data.id,
        activeOrderId: activeOrder.id,
        waitingOrderId: waitingOrder.id,
        eventMachineId: eventMachine.id,
        eventOperatorId: operatorByGrain.get(`${eventMachine.id}:day`),
        eventNightOperatorId: operatorByGrain.get(`${eventMachine.id}:night`),
        seededLogCount: logs.length,
    }
}

async function proveDashboard(admin, fixture, grain, assertions) {
    const startedAt = performance.now()
    const [orders, kpi, logCount] = await Promise.all([
        admin.rpc('get_active_orders_with_pace', { p_org_id: fixture.orgId, p_date: grain.today }),
        admin.rpc('get_kpi_today_live', { p_org_id: fixture.orgId, p_date: grain.today }),
        admin.from('production_logs').select('id', { count: 'exact', head: true }).eq('org_id', fixture.orgId),
    ])
    const elapsedMs = Math.round((performance.now() - startedAt) * 10) / 10
    if (orders.error) throw new Error(`order pace proof failed: ${orders.error.message}`)
    if (kpi.error) throw new Error(`KPI proof failed: ${kpi.error.message}`)
    const active = orders.data.find((row) => row.id === grain.activeOrderId)
    const waiting = orders.data.find((row) => row.id === grain.waitingOrderId)
    const produced = grain.seededLogCount
    const remaining = 5000 - produced
    const trailingDailyAverage = 20
    const requiredDailyPace = remaining / 5
    const expectedPace = Math.round((trailingDailyAverage / requiredDailyPace) * 100) / 100

    assertCondition(assertions, 'large dated dashboard source loads within two seconds without truncation',
        elapsedMs < 2000 && logCount.count === grain.seededLogCount && orders.data.length === 2, {
            elapsed_ms: elapsedMs,
            production_log_count: logCount.count,
            active_order_count: orders.data.length,
            range_start: grain.startDate,
            range_end: grain.today,
        })
    assertCondition(assertions, 'order pace matches independent remaining-meter and deadline arithmetic',
        Number(active?.meters_produced) === produced
        && Number(active?.meters_remaining) === remaining
        && Number(active?.days_remaining) === 5
        && Number(active?.pace_index) === expectedPace, {
            meters_produced: Number(active?.meters_produced),
            meters_remaining: Number(active?.meters_remaining),
            days_remaining: Number(active?.days_remaining),
            trailing_daily_average: trailingDailyAverage,
            required_daily_pace: requiredDailyPace,
            expected_pace_index: expectedPace,
            actual_pace_index: Number(active?.pace_index),
        })
    assertCondition(assertions, 'zero-production active order remains an explicit waiting risk rather than produced progress',
        Number(waiting?.meters_produced) === 0
        && Number(waiting?.meters_remaining) === 1000
        && Number(waiting?.days_remaining) === 10
        && Number(waiting?.pace_index) === 0, {
            waiting_order: waiting,
        })
    assertCondition(assertions, 'today KPI is the exact twenty-meter pre-realtime baseline',
        Number(kpi.data?.total_meters) === 20 && Number(kpi.data?.piece_rate_wages) === 80, {
            kpi: kpi.data,
        })
    return { elapsedMs, orders: orders.data, kpi: kpi.data }
}

async function emitRealtimeLog(env, stored, reconnect = false) {
    const owner = clientFor(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const signIn = await owner.auth.signInWithPassword(stored.owner)
    if (signIn.error) throw new Error(`emit sign-in failed: ${signIn.error.message}`)
    const grain = stored.grain
    let operatorId = reconnect ? grain.eventNightOperatorId : grain.eventOperatorId
    if (!operatorId) {
        const operator = await owner.from('machine_operator_assignments')
            .select('id')
            .eq('org_id', stored.fixture.orgId)
            .eq('machine_id', grain.eventMachineId)
            .eq('shift', reconnect ? 'night' : 'day')
            .single()
        if (operator.error || !operator.data) throw new Error(`emit operator lookup failed: ${operator.error?.message}`)
        operatorId = operator.data.id
    }
    const insert = await owner.from('production_logs').insert({
        org_id: stored.fixture.orgId,
        worker_id: grain.workerId,
        meter_worker_id: grain.workerId,
        fixed_worker_id: null,
        machine_id: grain.eventMachineId,
        order_id: grain.activeOrderId,
        meters: reconnect ? 15 : 25,
        date: grain.today,
        shift: reconnect ? 'night' : 'day',
        worker_rate_snapshot: 4,
        operator_assignment_id: operatorId,
        operator_worker_type: 'meter_worker',
        operator_pay_mode_snapshot: 'per_meter',
        operator_rate_snapshot: 4,
        machine_type_snapshot: 'rapier',
        created_by: stored.fixture.ownerUserId,
        client_ip: 'b14-realtime',
    }).select('id').single()
    if (insert.error || !insert.data) throw new Error(`realtime insert failed: ${insert.error?.message}`)
    process.stdout.write(`${JSON.stringify({
        emitted: true,
        phase: reconnect ? 'reconnect' : 'live',
        log_id: insert.data.id,
        expected_today_meters: reconnect ? 60 : 45,
        expected_today_wages: reconnect ? 240 : 180,
    }, null, 2)}\n`)
}

async function main() {
    const env = { ...process.env, ...parseEnv(await fs.readFile(envPath, 'utf8')) }
    if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(expectedProjectRef)) {
        throw new Error(`B14 refused: ${environmentName} project target was not proven.`)
    }
    const admin = clientFor(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    if (emitRealtime || emitReconnect) {
        const stored = JSON.parse(await fs.readFile(secretPath, 'utf8'))
        await emitRealtimeLog(env, stored, emitReconnect)
        return
    }
    if (cleanupOnly) {
        const stored = JSON.parse(await fs.readFile(secretPath, 'utf8'))
        const cleanupResult = await cleanup(admin, stored.fixture)
        if (cleanupResult.reconciled) await fs.rm(secretPath, { force: true })
        process.stdout.write(`${JSON.stringify({ cleanup: cleanupResult, secret_removed: cleanupResult.reconciled }, null, 2)}\n`)
        if (!cleanupResult.reconciled) process.exitCode = 1
        return
    }

    const assertions = []
    const evidence = {
        run_id: `B14-${environmentName.toUpperCase()}-${Date.now()}`,
        environment: environmentName,
        project_ref: expectedProjectRef,
        deployment: productionMode ? {
            id: process.env.B14_DEPLOYMENT_ID ?? null,
            commit: process.env.B14_DEPLOYMENT_COMMIT ?? null,
        } : undefined,
        scope: 'B14 realtime, reconnect, pace, large-range, and dashboard-state runtime proof',
        assertions,
        cleanup: 'pending',
    }
    let fixture = null
    try {
        fixture = await createFixture(admin, env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        const grain = await seedDashboard(admin, fixture)
        evidence.disposable_tenant = safeId(fixture.orgId)
        evidence.fixture = {
            range: `${grain.startDate}..${grain.today}`,
            seeded_logs: grain.seededLogCount,
            active_order: safeId(grain.activeOrderId),
            waiting_order: safeId(grain.waitingOrderId),
        }
        evidence.observations = await proveDashboard(admin, fixture, grain, assertions)
        evidence.passed = assertions.every((assertion) => assertion.passed)
        await fs.mkdir(path.dirname(outputPath), { recursive: true })
        if (preserveFixture) {
            await fs.mkdir(path.dirname(secretPath), { recursive: true })
            await fs.writeFile(secretPath, `${JSON.stringify({
                fixture: { orgId: fixture.orgId, ownerUserId: fixture.ownerUserId },
                owner: { email: fixture.email, password: fixture.password },
                grain,
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
        process.stdout.write(`${JSON.stringify({ path: outputPath, passed: evidence.passed, assertions: assertions.length, cleanup: evidence.cleanup }, null, 2)}\n`)
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
