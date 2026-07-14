#!/usr/bin/env node
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const QA_REF = 'eutycrtzzxmlkcpipgod'
const baseFixturePath = '/Users/rajpatel/.codex/secrets/weavly-formal-batch2.json'
const fixturePath = '/Users/rajpatel/.codex/secrets/weavly-formal-batch5.json'

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

const env = { ...process.env, ...parseEnv(await fs.readFile('.env.qa.local', 'utf8')) }
if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(QA_REF)) throw new Error('Batch 5 fixture refused: QA target not proven.')
if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Batch 5 fixture requires the QA service-role key.')

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
})

async function requireData(result, message) {
    if (result.error) throw new Error(`${message}: ${result.error.message}`)
    return result.data
}

async function setup() {
    try {
        await fs.access(fixturePath)
        throw new Error(`Refusing to overwrite existing fixture secret: ${fixturePath}`)
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error
    }

    const base = JSON.parse(await fs.readFile(baseFixturePath, 'utf8'))
    if (base.projectRef !== QA_REF || !base.runId?.startsWith('FORMAL-B2-')) throw new Error('Unexpected base fixture.')
    const orgId = base.premium.orgId
    const ownerId = base.premium.owner.userId
    const prefix = base.runId.replace('FORMAL-B2-', 'FORMAL-B5-')

    await requireData(
        await admin.from('organizations').update({ onboarding_complete: true, production_mode: 'both' }).eq('id', orgId),
        'Unable to prepare organization'
    )
    const worker = await requireData(
        await admin.from('workers').insert({
            org_id: orgId,
            name: `${prefix} Piece Worker`,
            is_active: true,
            date_of_birth: '1990-01-01',
            age_verification_method: 'other',
            age_verification_reference: 'QA-B5',
            age_verified_at: new Date().toISOString(),
            age_verified_by: ownerId,
        }).select('id').single(),
        'Unable to create piece-rate worker'
    )
    const fixedWorker = await requireData(
        await admin.from('fixed_workers').insert({
            org_id: orgId,
            name: `${prefix} Fixed Worker`,
            role: 'helper',
            monthly_salary: 12000,
            is_active: true,
            date_of_birth: '1991-01-01',
            age_verification_method: 'other',
            age_verification_reference: 'QA-B5',
            age_verified_at: new Date().toISOString(),
            age_verified_by: ownerId,
        }).select('id').single(),
        'Unable to create fixed worker'
    )
    const machine = await requireData(
        await admin.from('machines').insert({
            org_id: orgId,
            name: `${prefix} Setup Loom`,
            loom_type: 'jacquard',
            status: 'inactive',
        }).select('id').single(),
        'Unable to create setup loom'
    )
    const quote = await requireData(
        await admin.from('estimator_quotes').insert({
            org_id: orgId,
            party_name: `${prefix} Estimate Party`,
            quality_label: `${prefix} Setup Quality`,
            yarn_denier: 75,
            meters: 100,
            yarn_rate_per_kg: 150,
            job_work_charges: [],
            landed_cost_per_meter: 20,
            quote_price_per_meter: 25,
            intended_margin_percent: 20,
            worker_rate_per_m: 1.5,
            status: 'accepted',
        }).select('id').single(),
        'Unable to create estimator quote'
    )
    const order = await requireData(
        await admin.from('orders').insert({
            org_id: orgId,
            party_name: `${prefix} Order Party`,
            total_target_meters: 100,
            start_date: '2026-07-01',
            deadline: '2026-07-31',
            status: 'active',
            quality_label: `${prefix} Setup Quality`,
            worker_rate_per_m: 1.5,
        }).select('id').single(),
        'Unable to create setup order'
    )
    await requireData(
        await admin.from('machine_assignments').insert([
            { org_id: orgId, machine_id: machine.id, worker_id: worker.id, shift: 'day' },
            { org_id: orgId, machine_id: machine.id, worker_id: worker.id, shift: 'night' },
        ]),
        'Unable to create loom assignments'
    )
    await requireData(
        await admin.from('machines').update({ current_order_id: order.id, status: 'active' }).eq('id', machine.id),
        'Unable to activate and link setup loom'
    )
    await requireData(
        await admin.from('payroll_configs').insert({
            org_id: orgId,
            cycle_start_day: 1,
            pay_date_day: 10,
            pay_reminder_days: 3,
        }),
        'Unable to create payroll config'
    )

    const fixture = { prefix, orgId, ownerId, workerId: worker.id, fixedWorkerId: fixedWorker.id, machineId: machine.id, quoteId: quote.id, orderId: order.id }
    await fs.writeFile(fixturePath, JSON.stringify(fixture), { mode: 0o600 })
    process.stdout.write(`${JSON.stringify({ testId: 'SETUP-011', prefix, setupFoundationRows: 11, ready: true })}\n`)
}

async function verify() {
    const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'))
    const counts = {}
    for (const [label, table, filters] of [
        ['machines', 'machines', { id: fixture.machineId }],
        ['workers', 'workers', { id: fixture.workerId }],
        ['fixedWorkers', 'fixed_workers', { id: fixture.fixedWorkerId }],
        ['quotes', 'estimator_quotes', { id: fixture.quoteId }],
        ['orders', 'orders', { id: fixture.orderId }],
        ['payrollConfigs', 'payroll_configs', { org_id: fixture.orgId }],
    ]) {
        let query = admin.from(table).select(table === 'payroll_configs' ? 'org_id' : 'id', { count: 'exact', head: true })
        for (const [key, value] of Object.entries(filters)) query = query.eq(key, value)
        const result = await query
        if (result.error) {
            throw new Error(`Unable to verify ${label}: ${result.error.message}`)
        }
        counts[label] = result.count
    }
    const assignments = await admin.from('machine_assignments').select('shift').eq('org_id', fixture.orgId).eq('machine_id', fixture.machineId).order('shift')
    const machine = await admin.from('machines').select('status, current_order_id').eq('id', fixture.machineId).single()
    const supervisor = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('org_id', fixture.orgId).eq('role', 'supervisor')
    const subscription = await admin.from('org_subscriptions').select('id', { count: 'exact', head: true }).eq('org_id', fixture.orgId).in('status', ['active', 'authenticated'])
    if (assignments.error || machine.error || supervisor.error || subscription.error) throw new Error('Unable to reconcile setup fixture.')
    if (Object.values(counts).some((count) => count !== 1) || assignments.data.length !== 2 || machine.data.status !== 'active' || machine.data.current_order_id !== fixture.orderId || supervisor.count !== 1 || subscription.count !== 1) {
        throw new Error('Setup fixture reconciliation mismatch.')
    }
    process.stdout.write(`${JSON.stringify({
        testId: 'SETUP-011',
        counts,
        assignmentShifts: assignments.data.map((row) => row.shift),
        activeLinkedLoom: true,
        supervisorCount: supervisor.count,
        activePlanCount: subscription.count,
        expectedCompletedSteps: 11,
        expectedTotalSteps: 14,
    }, null, 2)}\n`)
}

async function cleanup() {
    const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'))
    for (const [table, column, value] of [
        ['machine_assignments', 'machine_id', fixture.machineId],
        ['estimator_quotes', 'id', fixture.quoteId],
        ['payroll_configs', 'org_id', fixture.orgId],
        ['machines', 'id', fixture.machineId],
        ['orders', 'id', fixture.orderId],
        ['workers', 'id', fixture.workerId],
        ['fixed_workers', 'id', fixture.fixedWorkerId],
    ]) {
        const result = await admin.from(table).delete().eq(column, value)
        if (result.error) throw new Error(`Unable to clean ${table}: ${result.error.message}`)
    }
    const remaining = await Promise.all([
        admin.from('machines').select('id', { count: 'exact', head: true }).eq('id', fixture.machineId),
        admin.from('workers').select('id', { count: 'exact', head: true }).eq('id', fixture.workerId),
        admin.from('fixed_workers').select('id', { count: 'exact', head: true }).eq('id', fixture.fixedWorkerId),
        admin.from('estimator_quotes').select('id', { count: 'exact', head: true }).eq('id', fixture.quoteId),
        admin.from('orders').select('id', { count: 'exact', head: true }).eq('id', fixture.orderId),
    ])
    if (remaining.some((result) => result.error || result.count !== 0)) throw new Error('Batch 5 cleanup reconciliation failed.')
    await fs.rm(fixturePath, { force: true })
    process.stdout.write(`${JSON.stringify({ testId: 'SETUP-011', cleaned: true, businessRowsRemaining: 0 })}\n`)
}

const command = process.argv[2]
if (command === 'setup') await setup()
else if (command === 'verify') await verify()
else if (command === 'cleanup') await cleanup()
else throw new Error('Usage: formal-batch5-setup-fixture.mjs setup|verify|cleanup')
