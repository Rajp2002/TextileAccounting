#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const QA_REF = 'eutycrtzzxmlkcpipgod'
const PROD_REF = 'vzhwahudircrpgtitwzd'
const SECRET_DIR = '/Users/rajpatel/.codex/secrets'
const SECRET_PATH = `${SECRET_DIR}/off-009-runtime.json`
const productionMode = process.argv.includes('--production')
const expectedRef = productionMode ? PROD_REF : QA_REF
const envFile = productionMode ? '.env.production.local' : '.env.qa.local'

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

const env = { ...process.env, ...parseEnv(await fs.readFile(envFile, 'utf8')) }
if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(expectedRef)) throw new Error(`OFF-009 fixture refused: ${expectedRef} target not proven.`)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const command = process.argv[2]

async function removeFixture(fixture) {
    if (fixture.orgId) {
        if (fixture.productionMode) {
            const operatorCleanup = await admin.from('machine_operator_assignments').delete().eq('org_id', fixture.orgId)
            if (operatorCleanup.error) throw new Error(`machine_operator_assignments cleanup failed: ${operatorCleanup.error.message}`)
        }
        for (const table of [
            'production_logs',
            'fabric_stock_movements',
            'fabric_stock_lots',
            'shift_assignments',
            'machine_assignments',
            'machines',
            'orders',
            'workers',
            'org_subscriptions',
            'profiles',
            'organizations',
        ]) {
            const result = await admin.from(table).delete().eq(table === 'organizations' ? 'id' : 'org_id', fixture.orgId)
            if (result.error) throw new Error(`${table} cleanup failed: ${result.error.message}`)
        }
    }

    if (fixture.userId) {
        const userDelete = await admin.auth.admin.deleteUser(fixture.userId)
        if (userDelete.error && userDelete.error.code !== 'user_not_found') throw userDelete.error
    }
}

if (command === 'setup') {
    const runId = `OFF009-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const email = `off009.${Date.now()}@example.test`
    const password = `${crypto.randomBytes(18).toString('base64url')}A1!`
    const userResult = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (userResult.error || !userResult.data.user) throw new Error('Unable to create OFF-009 supervisor.')
    const userId = userResult.data.user.id
    const fixture = { runId, email, password, userId, productionMode }

    try {
        const org = await admin.from('organizations').insert({
            name: `QA-${runId}`,
            owner_id: userId,
            onboarding_complete: true,
            production_mode: 'order_based',
        }).select('id').single()
        if (org.error || !org.data) throw org.error ?? new Error('Organization insert returned no row.')
        fixture.orgId = org.data.id

        const profile = await admin.from('profiles').insert({
            id: userId,
            org_id: fixture.orgId,
            role: 'supervisor',
            full_name: `QA Supervisor ${runId}`,
            email,
        })
        if (profile.error) throw profile.error

        const subscription = await admin.from('org_subscriptions').insert({
            org_id: fixture.orgId,
            plan_id: 'trial',
            plan_tier: 'premium',
            status: 'active',
            current_end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }).select('id').single()
        if (subscription.error || !subscription.data) throw subscription.error ?? new Error('Subscription insert returned no row.')
        fixture.subscriptionId = subscription.data.id

        const ageEvidence = (dateOfBirth, reference) => ({
            date_of_birth: dateOfBirth,
            age_verification_method: 'government_id',
            age_verification_reference: reference,
            age_verified_at: new Date().toISOString(),
            age_verified_by: userId,
        })
        const workers = await admin.from('workers').insert([
            {
                org_id: fixture.orgId,
                name: `QA ${runId} Day Worker`,
                is_active: true,
                ...ageEvidence('1990-01-01', 'QA-0001'),
            },
            {
                org_id: fixture.orgId,
                name: `QA ${runId} Night Worker`,
                is_active: true,
                ...ageEvidence('1991-01-01', 'QA-0002'),
            },
        ]).select('id')
        if (workers.error || workers.data?.length !== 2) throw workers.error ?? new Error('Worker insert returned wrong count.')
        fixture.workerIds = workers.data.map((worker) => worker.id)

        const order = await admin.from('orders').insert({
            org_id: fixture.orgId,
            party_name: `QA ${runId} Party`,
            quality_label: `QA ${runId} Order`,
            total_target_meters: 500,
            status: 'active',
            start_date: new Date().toISOString().slice(0, 10),
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            worker_rate_per_m: 2.5,
        }).select('id').single()
        if (order.error || !order.data) throw order.error ?? new Error('Order insert returned no row.')
        fixture.orderId = order.data.id

        const machine = await admin.from('machines').insert({
            org_id: fixture.orgId,
            name: `QA ${runId} Loom`,
            loom_type: 'rapier',
            status: 'inactive',
            current_order_id: fixture.orderId,
        }).select('id').single()
        if (machine.error || !machine.data) throw machine.error ?? new Error('Machine insert returned no row.')
        fixture.machineId = machine.data.id

        const standing = await admin.from('machine_assignments').insert([
            { org_id: fixture.orgId, machine_id: fixture.machineId, worker_id: fixture.workerIds[0], shift: 'day' },
            { org_id: fixture.orgId, machine_id: fixture.machineId, worker_id: fixture.workerIds[1], shift: 'night' },
        ])
        if (standing.error) throw standing.error

        if (productionMode) {
            const operatorAssignments = await admin.from('machine_operator_assignments').insert([
                {
                    org_id: fixture.orgId,
                    worker_type: 'meter_worker',
                    meter_worker_id: fixture.workerIds[0],
                    machine_id: fixture.machineId,
                    machine_type: 'rapier',
                    shift: 'day',
                    pay_mode: 'per_meter',
                    rate: 2.5,
                },
                {
                    org_id: fixture.orgId,
                    worker_type: 'meter_worker',
                    meter_worker_id: fixture.workerIds[1],
                    machine_id: fixture.machineId,
                    machine_type: 'rapier',
                    shift: 'night',
                    pay_mode: 'per_meter',
                    rate: 2.5,
                },
            ])
            if (operatorAssignments.error) throw operatorAssignments.error
        }

        const dated = await admin.from('shift_assignments').insert({
            org_id: fixture.orgId,
            machine_id: fixture.machineId,
            worker_id: fixture.workerIds[0],
            order_id: fixture.orderId,
            date: new Date().toISOString().slice(0, 10),
            shift: 'day',
            rate_per_m: 2.5,
        })
        if (dated.error) throw dated.error

        const activation = await admin.from('machines').update({ status: 'active' }).eq('id', fixture.machineId)
        if (activation.error) throw activation.error

        await fs.mkdir(SECRET_DIR, { recursive: true, mode: 0o700 })
        await fs.chmod(SECRET_DIR, 0o700)
        await fs.writeFile(SECRET_PATH, JSON.stringify(fixture), { mode: 0o600 })
        await fs.chmod(SECRET_PATH, 0o600)
        process.stdout.write(`${JSON.stringify({ runId, projectRef: expectedRef, fixtureReady: true })}\n`)
    } catch (error) {
        await removeFixture(fixture)
        throw error
    }
} else if (command === 'cleanup') {
    const fixture = JSON.parse(await fs.readFile(SECRET_PATH, 'utf8'))
    if (fixture.productionMode !== productionMode) {
        throw new Error(`OFF-009 fixture target mismatch: rerun cleanup with${fixture.productionMode ? '' : 'out'} --production.`)
    }
    await removeFixture(fixture)

    const [orgCount, profileCount, machineCount, logCount, authUser] = await Promise.all([
        admin.from('organizations').select('*', { count: 'exact', head: true }).eq('id', fixture.orgId),
        admin.from('profiles').select('*', { count: 'exact', head: true }).eq('id', fixture.userId),
        admin.from('machines').select('*', { count: 'exact', head: true }).eq('id', fixture.machineId),
        admin.from('production_logs').select('*', { count: 'exact', head: true }).eq('org_id', fixture.orgId),
        admin.auth.admin.getUserById(fixture.userId),
    ])
    if ([orgCount, profileCount, machineCount, logCount].some((result) => result.error || result.count !== 0) || authUser.data.user) {
        throw new Error('OFF-009 fixture cleanup reconciliation failed.')
    }
    await fs.rm(SECRET_PATH, { force: true })
    process.stdout.write(`${JSON.stringify({ runId: fixture.runId, projectRef: expectedRef, cleaned: true })}\n`)
} else if (command === 'cleanup-prefix') {
    if (!productionMode) throw new Error('OFF-009 prefix cleanup is restricted to an explicit --production target.')
    const fixtures = await admin.from('organizations').select('id,name,owner_id').like('name', 'QA-OFF009-%')
    if (fixtures.error) throw fixtures.error

    for (const organization of fixtures.data ?? []) {
        await removeFixture({ orgId: organization.id, userId: organization.owner_id, productionMode: true })
    }

    const remaining = await admin.from('organizations').select('*', { count: 'exact', head: true }).like('name', 'QA-OFF009-%')
    if (remaining.error || remaining.count !== 0) throw new Error('OFF-009 production prefix cleanup reconciliation failed.')
    process.stdout.write(`${JSON.stringify({ projectRef: expectedRef, matched: fixtures.data?.length ?? 0, remaining: 0 })}\n`)
} else {
    throw new Error('Usage: off-009-browser-fixture.mjs setup|cleanup|cleanup-prefix [--production]')
}
