#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'

const QA_REF = 'eutycrtzzxmlkcpipgod'
const PROD_REF = 'vzhwahudircrpgtitwzd'
const productionMode = process.argv.includes('--production')
const command = process.argv.find((arg) => !arg.startsWith('--') && arg !== process.argv[0] && arg !== process.argv[1])
const projectRef = productionMode ? PROD_REF : QA_REF
const envFile = productionMode ? '.env.production.local' : '.env.qa.local'
const environment = productionMode ? 'production' : 'qa'
const secretDir = '/Users/rajpatel/.codex/secrets'
const secretPath = path.join(secretDir, `weavly-b10-${environment}.json`)
const evidencePath = path.join(process.cwd(), `output/qa/blocked-row-campaign/B10-${environment}-boundaries.json`)

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

function dateAtOffset(dateString, days) {
    const date = new Date(`${dateString}T00:00:00.000Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
}

function suratToday() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date())
}

function firstOfMonth(dateString) {
    return `${dateString.slice(0, 7)}-01`
}

function previousMonthEnd(dateString) {
    return dateAtOffset(firstOfMonth(dateString), -1)
}

function nextMonthStart(dateString) {
    const date = new Date(`${firstOfMonth(dateString)}T00:00:00.000Z`)
    date.setUTCMonth(date.getUTCMonth() + 1)
    return date.toISOString().slice(0, 10)
}

function cycleStartForDate(dateString, startDay = 1) {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day >= startDay ? startDay : 1))
    if (day < startDay) date.setUTCMonth(date.getUTCMonth() - 1)
    return date.toISOString().slice(0, 10)
}

function safeId(value) {
    return typeof value === 'string' ? `${value.slice(0, 8)}...${value.slice(-4)}` : value
}

function hashCode(code) {
    return crypto.createHash('sha256').update(code).digest('hex')
}

function randomPassword() {
    return `${crypto.randomBytes(18).toString('base64url')}A1!`
}

function makeCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase()
}

const env = { ...process.env, ...parseEnv(await fs.readFile(envFile, 'utf8')) }
if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(projectRef)) {
    throw new Error(`B10 refused: ${projectRef} target was not proven.`)
}
if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(`B10 requires the anon and service-role keys for ${environment}.`)
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, clientOptions)

async function readFixture() {
    const fixture = JSON.parse(await fs.readFile(secretPath, 'utf8'))
    if (fixture.projectRef !== projectRef || fixture.environment !== environment || !fixture.runId?.startsWith('FORMAL-B10-')) {
        throw new Error('B10 secret does not match the selected environment.')
    }
    return fixture
}

async function saveFixture(fixture) {
    await fs.mkdir(secretDir, { recursive: true, mode: 0o700 })
    await fs.chmod(secretDir, 0o700)
    await fs.writeFile(secretPath, JSON.stringify(fixture), { mode: 0o600 })
    await fs.chmod(secretPath, 0o600)
}

async function signIn(fixture, role) {
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, clientOptions)
    const credentials = role === 'owner'
        ? { email: fixture.ownerEmail, password: fixture.ownerPassword }
        : { email: fixture.supervisorEmail, password: fixture.supervisorPassword }
    const result = await client.auth.signInWithPassword(credentials)
    if (result.error || !result.data.user) throw result.error ?? new Error(`${role} sign-in failed.`)
    return { client, user: result.data.user }
}

async function insertProductionLog(fixture, machineId, workerId, operatorAssignmentId) {
    const row = {
        org_id: fixture.orgId,
        machine_id: machineId,
        worker_id: workerId,
        order_id: fixture.orderId,
        meters: 10,
        opening_meter_reading: 0,
        closing_meter_reading: 10,
        counter_was_reset: false,
        shift: 'day',
        date: fixture.productionDate,
        worker_rate_snapshot: 2.5,
        created_by: fixture.supervisorUserId,
        updated_by: fixture.supervisorUserId,
        submitted_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        client_ip: `b10-${environment}-fixture`,
    }
    if (productionMode) {
        Object.assign(row, {
            operator_assignment_id: operatorAssignmentId,
            operator_worker_type: 'meter_worker',
            meter_worker_id: workerId,
            fixed_worker_id: null,
            operator_pay_mode_snapshot: 'per_meter',
            operator_rate_snapshot: 2.5,
            machine_type_snapshot: 'rapier',
        })
    }
    const result = await admin.from('production_logs').insert(row).select('id').single()
    if (result.error || !result.data) throw result.error ?? new Error('Production log insert returned no row.')
    return result.data.id
}

async function cleanupFixture(fixture, removeSecret = true) {
    const errors = []
    const deleteByOrg = [
        'commercial_payment_receipts',
        'commercial_receivables',
        'fabric_stock_movements',
        'fabric_stock_inward_drafts',
        'fabric_stock_lots',
        'production_logs',
        'payroll_settlements',
        'attendance',
        'shift_assignments',
        ...(productionMode ? ['machine_operator_assignments'] : []),
        'machine_assignments',
        'payroll_configs',
        'machines',
        'fixed_workers',
        'workers',
        'orders',
        'org_subscriptions',
        'audit_log',
    ]
    for (const table of deleteByOrg) {
        try {
            const result = await admin.from(table).delete().eq('org_id', fixture.orgId)
            if (result.error) errors.push(`${table}: ${result.error.message}`)
        } catch (error) {
            errors.push(`${table}: ${String(error?.message ?? error)}`)
        }
    }

    const userIds = [fixture.ownerUserId, fixture.supervisorUserId, ...(fixture.retiredSupervisorUserIds ?? [])].filter(Boolean)
    for (const [table, column, values] of [
        ['profiles', 'id', userIds],
        ['organizations', 'id', [fixture.orgId]],
    ]) {
        const result = await admin.from(table).delete().in(column, values)
        if (result.error) errors.push(`${table}: ${result.error.message}`)
    }
    for (const userId of userIds) {
        const result = await admin.auth.admin.deleteUser(userId)
        if (result.error && result.error.code !== 'user_not_found') errors.push(`auth ${safeId(userId)}: ${result.error.message}`)
    }

    const [orgs, profiles, logs, attendance, payments, ...authChecks] = await Promise.all([
        admin.from('organizations').select('id', { count: 'exact', head: true }).eq('id', fixture.orgId),
        admin.from('profiles').select('id', { count: 'exact', head: true }).in('id', userIds),
        admin.from('production_logs').select('id', { count: 'exact', head: true }).eq('org_id', fixture.orgId),
        admin.from('attendance').select('id', { count: 'exact', head: true }).eq('org_id', fixture.orgId),
        admin.from('commercial_payment_receipts').select('id', { count: 'exact', head: true }).eq('org_id', fixture.orgId),
        ...userIds.map((id) => admin.auth.admin.getUserById(id)),
    ])
    const reconciliation = {
        organizations: orgs.count,
        profiles: profiles.count,
        production_logs: logs.count,
        attendance: attendance.count,
        commercial_payments: payments.count,
        auth_users_exist: authChecks.filter((result) => Boolean(result.data.user)).length,
    }
    const reconciled = errors.length === 0 && Object.values(reconciliation).every((value) => value === 0)
    if (removeSecret && reconciled) await fs.rm(secretPath, { force: true })
    return { errors, reconciliation, reconciled }
}

if (command === 'setup') {
    const today = suratToday()
    const suffix = `${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const fixture = {
        runId: `FORMAL-B10-${suffix}`,
        environment,
        projectRef,
        today,
        productionDate: dateAtOffset(today, -2),
        pastAttendanceDate: dateAtOffset(today, -1),
        futureAttendanceDate: dateAtOffset(today, 1),
        currentMonthStart: firstOfMonth(today),
        previousMonthEnd: previousMonthEnd(today),
        nextMonthStart: nextMonthStart(today),
        ownerEmail: `formal.b10.${environment}.owner.${suffix}@example.test`,
        supervisorEmail: `formal.b10.${environment}.supervisor.${suffix}@example.test`,
        ownerPassword: randomPassword(),
        supervisorPassword: randomPassword(),
    }
    try {
        const [ownerAuth, supervisorAuth] = await Promise.all([
            admin.auth.admin.createUser({ email: fixture.ownerEmail, password: fixture.ownerPassword, email_confirm: true }),
            admin.auth.admin.createUser({ email: fixture.supervisorEmail, password: fixture.supervisorPassword, email_confirm: true }),
        ])
        if (ownerAuth.error || !ownerAuth.data.user) throw ownerAuth.error ?? new Error('Owner auth creation failed.')
        if (supervisorAuth.error || !supervisorAuth.data.user) throw supervisorAuth.error ?? new Error('Supervisor auth creation failed.')
        fixture.ownerUserId = ownerAuth.data.user.id
        fixture.supervisorUserId = supervisorAuth.data.user.id

        const org = await admin.from('organizations').insert({
            name: `QA-${fixture.runId}`,
            owner_id: fixture.ownerUserId,
            onboarding_complete: true,
            production_mode: 'order_based',
        }).select('id').single()
        if (org.error || !org.data) throw org.error ?? new Error('Organization insert returned no row.')
        fixture.orgId = org.data.id

        const profile = await admin.from('profiles').insert([
            { id: fixture.ownerUserId, org_id: fixture.orgId, role: 'owner', full_name: `QA Owner ${fixture.runId}`, email: fixture.ownerEmail },
            { id: fixture.supervisorUserId, org_id: fixture.orgId, role: 'supervisor', full_name: `QA Supervisor ${fixture.runId}`, email: fixture.supervisorEmail },
        ])
        if (profile.error) throw profile.error

        const subscription = await admin.from('org_subscriptions').insert({
            org_id: fixture.orgId,
            plan_id: 'trial',
            plan_tier: 'premium',
            status: 'active',
            current_end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        if (subscription.error) throw subscription.error

        const ageEvidence = (reference) => ({
            date_of_birth: '1990-01-01',
            age_verification_method: 'government_id',
            age_verification_reference: `${fixture.runId}-${reference}`,
            age_verified_at: new Date().toISOString(),
            age_verified_by: fixture.ownerUserId,
        })
        const workers = await admin.from('workers').insert([
            { org_id: fixture.orgId, name: `QA ${fixture.runId} Correction Worker`, is_active: true, ...ageEvidence('A') },
            { org_id: fixture.orgId, name: `QA ${fixture.runId} Settled Worker`, is_active: true, ...ageEvidence('B') },
        ]).select('id').order('id')
        if (workers.error || workers.data?.length !== 2) throw workers.error ?? new Error('Meter worker insert returned wrong count.')
        fixture.correctionWorkerId = workers.data[0].id
        fixture.settledWorkerId = workers.data[1].id

        const fixedWorker = await admin.from('fixed_workers').insert({
            org_id: fixture.orgId,
            name: `QA ${fixture.runId} Daily Worker`,
            role: 'daily',
            monthly_salary: 30000,
            is_active: true,
            ...ageEvidence('FIXED'),
        }).select('id').single()
        if (fixedWorker.error || !fixedWorker.data) throw fixedWorker.error ?? new Error('Fixed worker insert returned no row.')
        fixture.fixedWorkerId = fixedWorker.data.id

        const config = await admin.from('payroll_configs').insert({
            org_id: fixture.orgId,
            cycle_start_day: 1,
            pay_date_day: 10,
            pay_reminder_days: 3,
        })
        if (config.error) throw config.error

        const order = await admin.from('orders').insert({
            org_id: fixture.orgId,
            party_name: `QA ${fixture.runId} Party`,
            quality_label: `QA ${fixture.runId} Order`,
            total_target_meters: 1000,
            status: 'active',
            start_date: dateAtOffset(fixture.productionDate, -5),
            deadline: dateAtOffset(today, 14),
            worker_rate_per_m: 2.5,
        }).select('id').single()
        if (order.error || !order.data) throw order.error ?? new Error('Order insert returned no row.')
        fixture.orderId = order.data.id

        const machines = await admin.from('machines').insert([
            { org_id: fixture.orgId, name: `QA ${fixture.runId} Correction Loom`, loom_type: 'rapier', status: 'inactive', machine_status: 'running', current_order_id: fixture.orderId },
            { org_id: fixture.orgId, name: `QA ${fixture.runId} Settled Loom`, loom_type: 'rapier', status: 'inactive', machine_status: 'running', current_order_id: fixture.orderId },
        ]).select('id, name').order('name')
        if (machines.error || machines.data?.length !== 2) throw machines.error ?? new Error('Machine insert returned wrong count.')
        fixture.correctionMachineId = machines.data[0].id
        fixture.settledMachineId = machines.data[1].id

        const standing = await admin.from('machine_assignments').insert([
            { org_id: fixture.orgId, machine_id: fixture.correctionMachineId, worker_id: fixture.correctionWorkerId, shift: 'day' },
            { org_id: fixture.orgId, machine_id: fixture.correctionMachineId, worker_id: fixture.correctionWorkerId, shift: 'night' },
            { org_id: fixture.orgId, machine_id: fixture.settledMachineId, worker_id: fixture.settledWorkerId, shift: 'day' },
            { org_id: fixture.orgId, machine_id: fixture.settledMachineId, worker_id: fixture.settledWorkerId, shift: 'night' },
        ])
        if (standing.error) throw standing.error

        const dated = await admin.from('shift_assignments').insert([
            { org_id: fixture.orgId, machine_id: fixture.correctionMachineId, worker_id: fixture.correctionWorkerId, order_id: fixture.orderId, date: fixture.productionDate, shift: 'day', rate_per_m: 2.5, created_by: fixture.ownerUserId },
            { org_id: fixture.orgId, machine_id: fixture.settledMachineId, worker_id: fixture.settledWorkerId, order_id: fixture.orderId, date: fixture.productionDate, shift: 'day', rate_per_m: 2.5, created_by: fixture.ownerUserId },
        ])
        if (dated.error) throw dated.error

        const operatorAssignmentIds = [null, null]
        if (productionMode) {
            const operatorAssignments = await admin.from('machine_operator_assignments').insert([
                { org_id: fixture.orgId, machine_id: fixture.correctionMachineId, machine_type: 'rapier', shift: 'day', worker_type: 'meter_worker', meter_worker_id: fixture.correctionWorkerId, fixed_worker_id: null, pay_mode: 'per_meter', rate: 2.5, effective_from: fixture.productionDate, is_primary_operator: true, active: true },
                { org_id: fixture.orgId, machine_id: fixture.settledMachineId, machine_type: 'rapier', shift: 'day', worker_type: 'meter_worker', meter_worker_id: fixture.settledWorkerId, fixed_worker_id: null, pay_mode: 'per_meter', rate: 2.5, effective_from: fixture.productionDate, is_primary_operator: true, active: true },
            ]).select('id, machine_id')
            if (operatorAssignments.error || operatorAssignments.data?.length !== 2) throw operatorAssignments.error ?? new Error('Operator assignment insert returned wrong count.')
            operatorAssignmentIds[0] = operatorAssignments.data.find((row) => row.machine_id === fixture.correctionMachineId)?.id ?? null
            operatorAssignmentIds[1] = operatorAssignments.data.find((row) => row.machine_id === fixture.settledMachineId)?.id ?? null
        }

        const activation = await admin.from('machines').update({ status: 'active' }).eq('org_id', fixture.orgId)
        if (activation.error) throw activation.error

        fixture.correctionLogId = await insertProductionLog(fixture, fixture.correctionMachineId, fixture.correctionWorkerId, operatorAssignmentIds[0])
        fixture.settledLogId = await insertProductionLog(fixture, fixture.settledMachineId, fixture.settledWorkerId, operatorAssignmentIds[1])

        const cycleStart = cycleStartForDate(fixture.productionDate, 1)
        fixture.cycleStart = cycleStart
        const settlement = await admin.from('payroll_settlements').insert({
            org_id: fixture.orgId,
            worker_type: 'meter',
            meter_worker_id: fixture.settledWorkerId,
            fixed_worker_id: null,
            month: cycleStart.slice(0, 7),
            cycle_start_date: cycleStart,
            gross_pay: 25,
            advance_deducted: 0,
            net_payout: 25,
            carried_forward_debt: 0,
            status: 'paid',
            payment_mode: 'cash',
        }).select('id').single()
        if (settlement.error || !settlement.data) throw settlement.error ?? new Error('Settlement insert returned no row.')
        fixture.settlementId = settlement.data.id

        const receivable = await admin.from('commercial_receivables').insert({
            org_id: fixture.orgId,
            source_type: 'party_invoice',
            source_id: crypto.randomUUID(),
            source_date: fixture.today,
            order_id: fixture.orderId,
            party_name: `QA ${fixture.runId} Boundary Party`,
            quality_label: `QA ${fixture.runId} Boundary Quality`,
            total_amount: 10000,
            received_amount: 1515.15,
            payment_status: 'partial',
            created_by: fixture.ownerUserId,
            updated_by: fixture.ownerUserId,
        }).select('id').single()
        if (receivable.error || !receivable.data) throw receivable.error ?? new Error('Receivable insert returned no row.')
        fixture.receivableId = receivable.data.id

        const payments = [
            [fixture.previousMonthEnd, 33.33, 'previous-month-end'],
            [fixture.currentMonthStart, 111.11, 'current-month-start'],
            [fixture.today, 222.22, 'current-day'],
            [fixture.nextMonthStart, 44.44, 'next-month-start'],
            ['2024-02-29', 404.04, 'leap-day'],
            ['2025-12-31', 505.05, 'year-end'],
            ['2026-01-01', 195.96, 'year-start'],
        ].map(([paymentDate, amount, label]) => ({
            org_id: fixture.orgId,
            receivable_id: fixture.receivableId,
            amount,
            payment_date: paymentDate,
            payment_mode: 'bank',
            reference_number: `${fixture.runId}-${label}`,
            created_by: fixture.ownerUserId,
        }))
        const paymentInsert = await admin.from('commercial_payment_receipts').insert(payments)
        if (paymentInsert.error) throw paymentInsert.error

        await saveFixture(fixture)
        process.stdout.write(`${JSON.stringify({
            runId: fixture.runId,
            projectRef,
            environment,
            fixtureReady: true,
            productionDate: fixture.productionDate,
            orgId: safeId(fixture.orgId),
            correctionMachineId: safeId(fixture.correctionMachineId),
            settledMachineId: safeId(fixture.settledMachineId),
        }, null, 2)}\n`)
    } catch (error) {
        if (fixture.orgId) await cleanupFixture(fixture, false)
        else {
            for (const userId of [fixture.ownerUserId, fixture.supervisorUserId].filter(Boolean)) {
                await admin.auth.admin.deleteUser(userId)
            }
        }
        throw error
    }
} else if (command === 'rotate-supervisor') {
    const fixture = await readFixture()
    const suffix = `${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const email = `formal.b10.${environment}.supervisor.proof.${suffix}@example.test`
    const password = randomPassword()
    const auth = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (auth.error || !auth.data.user) throw auth.error ?? new Error('Proof supervisor auth creation failed.')
    const profile = await admin.from('profiles').insert({
        id: auth.data.user.id,
        org_id: fixture.orgId,
        role: 'supervisor',
        full_name: `QA Supervisor Proof ${fixture.runId}`,
        email,
    })
    if (profile.error) {
        await admin.auth.admin.deleteUser(auth.data.user.id)
        throw profile.error
    }
    fixture.retiredSupervisorUserIds = [...(fixture.retiredSupervisorUserIds ?? []), fixture.supervisorUserId]
    fixture.supervisorUserId = auth.data.user.id
    fixture.supervisorEmail = email
    fixture.supervisorPassword = password
    await saveFixture(fixture)
    process.stdout.write(`${JSON.stringify({ runId: fixture.runId, environment, supervisorRotated: true, supervisorUserId: safeId(fixture.supervisorUserId) })}\n`)
} else if (command === 'seed-valid-code' || command === 'seed-expired-code') {
    const fixture = await readFixture()
    const code = makeCode()
    const expiresAt = command === 'seed-valid-code'
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : new Date(Date.now() - 60 * 1000).toISOString()
    const result = await admin.from('organizations').update({
        access_code_hash: hashCode(code),
        access_code_expires_at: expiresAt,
        last_code_plain: null,
    }).eq('id', fixture.orgId)
    if (result.error) throw result.error
    fixture.activeCode = code
    fixture.activeCodeKind = command === 'seed-valid-code' ? 'valid' : 'expired'
    await saveFixture(fixture)
    process.stdout.write(`${JSON.stringify({ runId: fixture.runId, environment, seeded: fixture.activeCodeKind, expiresAt })}\n`)
} else if (command === 'age-correction-log') {
    const fixture = await readFixture()
    const result = await admin.from('production_logs').update({
        submitted_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    }).eq('org_id', fixture.orgId)
        .eq('machine_id', fixture.correctionMachineId)
        .eq('date', fixture.productionDate)
        .eq('shift', 'day')
        .select('id')
    if (result.error) throw result.error
    if (result.data?.length !== 1) throw new Error(`Expected one correction log to age; found ${result.data?.length ?? 0}`)
    fixture.correctionLogId = result.data[0].id
    await saveFixture(fixture)
    process.stdout.write(`${JSON.stringify({ runId: fixture.runId, environment, correctionLogAged: true })}\n`)
} else if (command === 'reset-code-rate-limit') {
    const fixture = await readFixture()
    if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
        throw new Error('B10 requires Upstash credentials to reset the disposable supervisor limiter.')
    }
    const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
    let cursor = '0'
    const keys = []
    do {
        const [nextCursor, matches] = await redis.scan(cursor, { match: `*${fixture.supervisorUserId}*`, count: 100 })
        cursor = nextCursor
        keys.push(...matches)
    } while (cursor !== '0')
    if (keys.length > 0) await redis.del(...keys)
    process.stdout.write(`${JSON.stringify({ runId: fixture.runId, environment, disposableRateLimitKeysDeleted: keys.length })}\n`)
} else if (command === 'probe') {
    const fixture = await readFixture()
    const ownerSession = await signIn(fixture, 'owner')
    const supervisorSession = await signIn(fixture, 'supervisor')

    await admin.from('attendance').delete().eq('org_id', fixture.orgId)
    const attendancePayload = (date, markedBy) => ({
        org_id: fixture.orgId,
        fixed_worker_id: fixture.fixedWorkerId,
        date,
        present: true,
        marked_by: markedBy,
        client_ip: `b10-${environment}-probe`,
    })
    const supervisorToday = await supervisorSession.client.from('attendance').insert(attendancePayload(fixture.today, fixture.supervisorUserId))
    const supervisorPast = await supervisorSession.client.from('attendance').insert(attendancePayload(fixture.pastAttendanceDate, fixture.supervisorUserId))
    const supervisorFuture = await supervisorSession.client.from('attendance').insert(attendancePayload(fixture.futureAttendanceDate, fixture.supervisorUserId))
    const ownerPast = await ownerSession.client.from('attendance').insert(attendancePayload(fixture.pastAttendanceDate, fixture.ownerUserId))
    const ownerFuture = await ownerSession.client.from('attendance').insert(attendancePayload(fixture.futureAttendanceDate, fixture.ownerUserId))

    const lock = await admin.from('organizations').update({ is_locked_down: true }).eq('id', fixture.orgId)
    if (lock.error) throw lock.error
    const lockedTodayUpdate = await supervisorSession.client.from('attendance')
        .update({ present: false })
        .eq('org_id', fixture.orgId)
        .eq('fixed_worker_id', fixture.fixedWorkerId)
        .eq('date', fixture.today)
        .select('id')
    const unlock = await admin.from('organizations').update({ is_locked_down: false }).eq('id', fixture.orgId)
    if (unlock.error) throw unlock.error

    const duplicatePayload = [{
        machine_id: fixture.correctionMachineId,
        worker_id: fixture.correctionWorkerId,
        order_id: fixture.orderId,
        meters: 12,
        opening_meter_reading: 0,
        closing_meter_reading: 12,
        counter_was_reset: false,
        shift: 'day',
        date: fixture.productionDate,
        worker_rate_snapshot: 2.5,
        submitted_at: new Date().toISOString(),
        client_ip: `b10-${environment}-duplicate-probe`,
    }]
    if (productionMode) {
        Object.assign(duplicatePayload[0], {
            operator_worker_type: 'meter_worker',
            meter_worker_id: fixture.correctionWorkerId,
            fixed_worker_id: null,
            operator_pay_mode_snapshot: 'per_meter',
            operator_rate_snapshot: 2.5,
            machine_type_snapshot: 'rapier',
        })
    }
    const noOverwrite = await supervisorSession.client.rpc('replace_shift_production_logs', {
        p_logs: duplicatePayload,
        p_allow_overwrite: false,
        p_access_code_used: false,
    })

    const [attendanceRows, paymentRows, logs, settlement] = await Promise.all([
        admin.from('attendance').select('date, present, marked_by').eq('org_id', fixture.orgId).order('date'),
        admin.from('commercial_payment_receipts').select('amount, payment_date, reference_number').eq('org_id', fixture.orgId).order('payment_date'),
        admin.from('production_logs').select('id, machine_id, meters, submitted_at').eq('org_id', fixture.orgId).order('id'),
        admin.from('payroll_settlements').select('id, status, cycle_start_date, meter_worker_id').eq('id', fixture.settlementId).single(),
    ])
    const firstError = [attendanceRows, paymentRows, logs, settlement].find((result) => result.error)?.error
    if (firstError) throw firstError
    const currentMonthPayments = (paymentRows.data ?? []).filter((row) => row.payment_date >= fixture.currentMonthStart && row.payment_date <= fixture.today)
    const currentMonthTotal = currentMonthPayments.reduce((sum, row) => sum + Number(row.amount), 0)
    const paymentDates = new Set((paymentRows.data ?? []).map((row) => row.payment_date))
    const assertions = {
        supervisor_today_direct_write_allowed: !supervisorToday.error,
        supervisor_past_direct_write_blocked: Boolean(supervisorPast.error),
        supervisor_future_direct_write_blocked: Boolean(supervisorFuture.error),
        owner_past_direct_write_allowed: !ownerPast.error,
        owner_future_direct_write_blocked: Boolean(ownerFuture.error),
        locked_tenant_update_blocked: !lockedTodayUpdate.error && (lockedTodayUpdate.data?.length ?? 0) === 0,
        old_log_without_overwrite_rejected: Boolean(noOverwrite.error?.message?.includes('DUPLICATE_LOG_DETECTED')),
        production_logs_unchanged: logs.data?.length === 2 && logs.data.every((row) => Number(row.meters) === 10),
        settled_period_fixture_present: settlement.data?.status === 'paid'
            && settlement.data?.cycle_start_date === fixture.cycleStart
            && settlement.data?.meter_worker_id === fixture.settledWorkerId,
        current_month_uses_india_date_boundaries: Math.abs(currentMonthTotal - 333.33) < 0.001
            && currentMonthPayments.length === (fixture.currentMonthStart === fixture.today ? 2 : 2),
        previous_and_next_month_excluded: !currentMonthPayments.some((row) => row.payment_date === fixture.previousMonthEnd || row.payment_date === fixture.nextMonthStart),
        year_boundary_dates_round_trip: paymentDates.has('2025-12-31') && paymentDates.has('2026-01-01'),
        leap_day_round_trips: paymentDates.has('2024-02-29'),
    }
    const evidence = {
        runId: fixture.runId,
        projectRef,
        environment,
        checkedAt: new Date().toISOString(),
        dates: {
            today: fixture.today,
            production: fixture.productionDate,
            pastAttendance: fixture.pastAttendanceDate,
            futureAttendance: fixture.futureAttendanceDate,
            previousMonthEnd: fixture.previousMonthEnd,
            currentMonthStart: fixture.currentMonthStart,
            nextMonthStart: fixture.nextMonthStart,
            cycleStart: fixture.cycleStart,
        },
        database: {
            attendanceRows: attendanceRows.data?.map((row) => ({ ...row, marked_by: safeId(row.marked_by) })),
            currentMonthPaymentDates: currentMonthPayments.map((row) => row.payment_date),
            currentMonthTotal,
            paymentDates: [...paymentDates],
            productionLogCount: logs.data?.length ?? 0,
            productionMetersType: logs.data?.[0] ? typeof logs.data[0].meters : null,
            settlementStatus: settlement.data?.status ?? null,
        },
        assertions,
        pass: Object.values(assertions).every(Boolean),
    }
    await fs.mkdir(path.dirname(evidencePath), { recursive: true })
    await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`)
    process.stdout.write(`${JSON.stringify({ path: evidencePath, ...evidence }, null, 2)}\n`)
    if (!evidence.pass) process.exitCode = 1
} else if (command === 'auth-snapshot') {
    const fixture = await readFixture()
    const supervisorSession = await signIn(fixture, 'supervisor')
    const fixtureMachineIds = [fixture.correctionMachineId, fixture.settledMachineId]
    const [logs, machines, assignments] = await Promise.all([
        supervisorSession.client.from('production_logs').select('id, machine_id, date, shift, meters, opening_meter_reading, closing_meter_reading, counter_was_reset, submitted_at, zero_meter_reason')
            .eq('org_id', fixture.orgId).eq('date', fixture.productionDate).eq('shift', 'day').in('machine_id', fixtureMachineIds),
        supervisorSession.client.from('machines').select('id, name, status').eq('org_id', fixture.orgId),
        supervisorSession.client.from('shift_assignments').select('id, machine_id, date, shift').eq('org_id', fixture.orgId),
    ])
    process.stdout.write(`${JSON.stringify({
        runId: fixture.runId,
        environment,
        authenticatedSupervisor: {
            productionLogCount: logs.data?.length ?? 0,
            productionLogError: logs.error?.message ?? null,
            productionMetersType: logs.data?.[0] ? typeof logs.data[0].meters : null,
            machineCount: machines.data?.length ?? 0,
            machineError: machines.error?.message ?? null,
            shiftAssignmentCount: assignments.data?.length ?? 0,
            shiftAssignmentError: assignments.error?.message ?? null,
        },
    }, null, 2)}\n`)
} else if (command === 'snapshot') {
    const fixture = await readFixture()
    const [logs, settlement, attendance, payments, org] = await Promise.all([
        admin.from('production_logs').select('id, machine_id, worker_id, meter_worker_id, meters, date, shift, submitted_at').eq('org_id', fixture.orgId).order('id'),
        admin.from('payroll_settlements').select('id, status, cycle_start_date, meter_worker_id').eq('org_id', fixture.orgId),
        admin.from('attendance').select('id, date, present, marked_by').eq('org_id', fixture.orgId).order('date'),
        admin.from('commercial_payment_receipts').select('amount, payment_date').eq('org_id', fixture.orgId).order('payment_date'),
        admin.from('organizations').select('id, access_code_hash, access_code_expires_at, is_locked_down').eq('id', fixture.orgId).single(),
    ])
    const firstError = [logs, settlement, attendance, payments, org].find((result) => result.error)?.error
    if (firstError) throw firstError
    process.stdout.write(`${JSON.stringify({
        runId: fixture.runId,
        environment,
        logs: logs.data?.map((row) => ({ ...row, id: safeId(String(row.id)), machine_id: safeId(row.machine_id) })),
        settlements: settlement.data,
        attendance: attendance.data,
        payments: payments.data,
        accessCode: {
            hashPresent: Boolean(org.data?.access_code_hash),
            expiresAt: org.data?.access_code_expires_at ?? null,
            kind: fixture.activeCodeKind ?? null,
        },
    }, null, 2)}\n`)
} else if (command === 'cleanup') {
    const fixture = await readFixture()
    const result = await cleanupFixture(fixture)
    process.stdout.write(`${JSON.stringify({ runId: fixture.runId, projectRef, environment, ...result }, null, 2)}\n`)
    if (!result.reconciled) process.exitCode = 1
} else {
    throw new Error('Usage: formal-b10-boundary-fixture.mjs setup|probe|rotate-supervisor|seed-valid-code|seed-expired-code|age-correction-log|reset-code-rate-limit|auth-snapshot|snapshot|cleanup [--production]')
}
