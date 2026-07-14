#!/usr/bin/env node
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const QA_REF = 'eutycrtzzxmlkcpipgod'
const fixturePath = '/Users/rajpatel/.codex/secrets/weavly-formal-batch2.json'

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
if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(QA_REF)) {
    throw new Error('Batch 4 probe refused: isolated QA target not proven.')
}
if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Batch 4 probe requires the QA service-role key.')

const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'))
if (fixture.projectRef !== QA_REF || !fixture.runId?.startsWith('FORMAL-B2-')) {
    throw new Error('Batch 4 probe refused: unexpected fixture identity.')
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
})

async function requireData(result, message) {
    if (result.error) throw new Error(`${message}: ${result.error.message}`)
    return result.data
}

function assertDuplicateError(error, label) {
    if (error?.code !== '23505' || !/machines_org_normalized_name_unique/i.test(`${error.message} ${error.details}`)) {
        throw new Error(`${label}: expected machines normalized-name 23505 boundary`)
    }
}

async function probe() {
    const browserRows = await requireData(
        await admin.from('machines')
            .select('id, org_id, name, loom_type')
            .eq('org_id', fixture.premium.orgId)
            .in('name', ['Jacquard 1', 'Jacquard 2'])
            .order('name'),
        'Unable to verify browser-created looms'
    )

    if (browserRows.length !== 2 || browserRows.some((row) => row.loom_type !== 'jacquard')) {
        throw new Error('Browser bulk-add did not persist exactly two distinct Jacquard looms.')
    }

    const duplicateInsert = await admin.from('machines').insert({
        org_id: fixture.premium.orgId,
        name: '  jAcQuArD 1  ',
        loom_type: 'jacquard',
        status: 'inactive',
    })
    assertDuplicateError(duplicateInsert.error, 'Trim/case duplicate insert')

    const jacquardTwo = browserRows.find((row) => row.name === 'Jacquard 2')
    const duplicateRename = await admin.from('machines')
        .update({ name: ' JACQUARD 1 ' })
        .eq('id', jacquardTwo.id)
        .eq('org_id', fixture.premium.orgId)
    assertDuplicateError(duplicateRename.error, 'Trim/case duplicate rename')

    const crossTenant = await requireData(
        await admin.from('machines').insert({
            org_id: fixture.base.orgId,
            name: 'Jacquard 1',
            loom_type: 'jacquard',
            status: 'inactive',
        }).select('id, name, loom_type').single(),
        'Same name in another organization should be valid'
    )

    const sameTypeDifferentNames = await requireData(
        await admin.from('machines').insert([
            { org_id: fixture.premium.orgId, name: 'Rapier Boundary A', loom_type: 'rapier', status: 'inactive' },
            { org_id: fixture.premium.orgId, name: 'Rapier Boundary B', loom_type: 'rapier', status: 'inactive' },
        ]).select('id, name, loom_type'),
        'Different names of the same type should be valid'
    )

    const finalPremiumRows = await requireData(
        await admin.from('machines')
            .select('id, name, loom_type')
            .eq('org_id', fixture.premium.orgId)
            .order('name'),
        'Unable to reconcile premium machine rows'
    )
    const normalizedCounts = new Map()
    for (const row of finalPremiumRows) {
        const normalized = row.name.trim().toLowerCase()
        normalizedCounts.set(normalized, (normalizedCounts.get(normalized) ?? 0) + 1)
    }
    if ([...normalizedCounts.values()].some((count) => count !== 1)) {
        throw new Error('Normalized duplicate machine rows remain in the premium fixture.')
    }

    process.stdout.write(`${JSON.stringify({
        testId: 'MASTER-002',
        projectRef: QA_REF,
        runId: fixture.runId,
        browserBulk: {
            requestedTypeGroups: ['jacquard', 'jacquard'],
            persistedNames: browserRows.map((row) => row.name),
            persistedCount: browserRows.length,
        },
        duplicateInsert: { rejected: true, code: duplicateInsert.error.code },
        duplicateRename: { rejected: true, code: duplicateRename.error.code },
        tenantScope: { sameNameDifferentOrganizationAllowed: crossTenant.name === 'Jacquard 1' },
        typeRule: {
            sameTypeDifferentNamesAllowed: sameTypeDifferentNames.length === 2,
            names: sameTypeDifferentNames.map((row) => row.name),
        },
        finalPremiumCount: finalPremiumRows.length,
        normalizedDuplicateCount: 0,
    }, null, 2)}\n`)
}

async function cleanup() {
    const orgIds = [fixture.premium.orgId, fixture.base.orgId]
    for (const table of ['production_logs', 'shift_assignments', 'machine_assignments', 'orders', 'workers']) {
        const deletion = await admin.from(table).delete().in('org_id', orgIds)
        if (deletion.error) throw new Error(`Unable to delete Batch 4 ${table}: ${deletion.error.message}`)
    }
    const deletion = await admin.from('machines').delete().in('org_id', orgIds)
    if (deletion.error) throw new Error(`Unable to delete Batch 4 machines: ${deletion.error.message}`)

    const remaining = await admin.from('machines').select('id', { count: 'exact', head: true }).in('org_id', orgIds)
    if (remaining.error || remaining.count !== 0) {
        throw new Error(`Batch 4 machine cleanup failed: remaining=${remaining.count ?? 'unknown'}`)
    }
    process.stdout.write(`${JSON.stringify({ testId: 'MASTER-002', cleaned: true, machineRowsRemaining: 0 })}\n`)
}

async function setupHistory() {
    const machine = await requireData(
        await admin.from('machines').select('id, name').eq('org_id', fixture.premium.orgId).eq('name', 'Jacquard 1').single(),
        'Unable to find history fixture loom'
    )
    const worker = await requireData(
        await admin.from('workers').insert({
            org_id: fixture.premium.orgId,
            name: `${fixture.runId} History Worker`,
            is_active: true,
            date_of_birth: '1990-01-01',
            age_verification_method: 'other',
            age_verification_reference: 'QA-B4',
            age_verified_at: new Date().toISOString(),
            age_verified_by: fixture.premium.owner.userId,
        }).select('id').single(),
        'Unable to create history fixture worker'
    )
    const order = await requireData(
        await admin.from('orders').insert({
            org_id: fixture.premium.orgId,
            party_name: `${fixture.runId} History Party`,
            total_target_meters: 100,
            start_date: '2026-07-01',
            deadline: '2026-07-31',
            status: 'active',
            quality_label: 'Batch 4 history quality',
        }).select('id').single(),
        'Unable to create history fixture order'
    )
    await requireData(
        await admin.from('machine_assignments').insert([
            { org_id: fixture.premium.orgId, machine_id: machine.id, worker_id: worker.id, shift: 'day' },
            { org_id: fixture.premium.orgId, machine_id: machine.id, worker_id: worker.id, shift: 'night' },
        ]),
        'Unable to create standing assignments'
    )
    await requireData(
        await admin.from('machines').update({ current_order_id: order.id, status: 'active' }).eq('id', machine.id).select('id').single(),
        'Unable to link history fixture loom'
    )
    await requireData(
        await admin.from('shift_assignments').insert({
            org_id: fixture.premium.orgId,
            date: '2026-07-12',
            shift: 'day',
            machine_id: machine.id,
            worker_id: worker.id,
            primary_worker_id: worker.id,
            order_id: order.id,
            rate_per_m: 1.5,
            created_by: fixture.premium.owner.userId,
        }),
        'Unable to create dated shift assignment'
    )
    const log = await requireData(
        await admin.from('production_logs').insert({
            org_id: fixture.premium.orgId,
            worker_id: worker.id,
            machine_id: machine.id,
            order_id: order.id,
            meters: 10,
            date: '2026-07-12',
            shift: 'day',
            worker_rate_snapshot: 1.5,
            opening_meter_reading: 0,
            closing_meter_reading: 10,
            created_by: fixture.premium.owner.userId,
            updated_by: fixture.premium.owner.userId,
            client_ip: 'qa-fixture',
        }).select('id').single(),
        'Unable to create production history'
    )
    process.stdout.write(`${JSON.stringify({ historyReady: true, machineName: machine.name, workerId: worker.id, productionLogId: log.id })}\n`)
}

async function verifyHistory() {
    const machine = await requireData(
        await admin.from('machines')
            .select('id, name, loom_type, status, current_order_id')
            .eq('org_id', fixture.premium.orgId)
            .eq('name', 'History Loom Edited')
            .single(),
        'Unable to verify edited history loom'
    )
    const [standing, dated, logs] = await Promise.all([
        admin.from('machine_assignments').select('id', { count: 'exact', head: true }).eq('org_id', fixture.premium.orgId).eq('machine_id', machine.id),
        admin.from('shift_assignments').select('id', { count: 'exact', head: true }).eq('org_id', fixture.premium.orgId).eq('machine_id', machine.id),
        admin.from('production_logs').select('id, meters').eq('org_id', fixture.premium.orgId).eq('machine_id', machine.id),
    ])
    if (standing.error || dated.error || logs.error) throw new Error('Unable to reconcile history references.')
    if (standing.count !== 2 || dated.count !== 1 || logs.data.length !== 1 || Number(logs.data[0].meters) !== 10) {
        throw new Error('History references changed during edit or protected lifecycle attempts.')
    }
    const unused = await admin.from('machines').select('id', { count: 'exact', head: true })
        .eq('org_id', fixture.premium.orgId).eq('name', 'Rapier Boundary B')
    if (unused.error || unused.count !== 0) throw new Error('Unused loom deletion did not persist.')

    process.stdout.write(`${JSON.stringify({
        machine: { name: machine.name, loomType: machine.loom_type, status: machine.status, activeTargetPreserved: Boolean(machine.current_order_id) },
        references: { standingAssignments: standing.count, datedAssignments: dated.count, productionLogs: logs.data.length, meters: Number(logs.data[0].meters) },
        protectedAttempts: { deactivatePreservedActiveStatus: machine.status === 'active', deletePreservedRow: true },
        unusedLoomDeletion: { persisted: unused.count === 0 },
    }, null, 2)}\n`)
}

const command = process.argv[2]
if (command === 'probe') await probe()
else if (command === 'setup-history') await setupHistory()
else if (command === 'verify-history') await verifyHistory()
else if (command === 'cleanup') await cleanup()
else throw new Error('Usage: formal-batch4-master-probe.mjs probe|setup-history|verify-history|cleanup')
