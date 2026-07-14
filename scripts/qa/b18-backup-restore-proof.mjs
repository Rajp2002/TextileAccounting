#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const QA_REF = 'eutycrtzzxmlkcpipgod'
const outputPath = path.join(root, 'output/qa/blocked-row-campaign/B18-qa-backup-restore.json')
const privateBackupPath = path.join(root, '.codex/b18-recovery-backup.private.json')

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

function assertCondition(assertions, name, passed, details = {}) {
    assertions.push({ name, passed, ...details })
    if (!passed) throw new Error(`${name} failed: ${JSON.stringify(details)}`)
}

function safeId(value) {
    return typeof value === 'string' ? `${value.slice(0, 8)}...${value.slice(-4)}` : value
}

function canonicalSummary(backup) {
    const numeric = (value) => Number(value)
    return {
        organization: {
            id: backup.organization.id,
            name: backup.organization.name,
            onboarding_complete: backup.organization.onboarding_complete,
            production_mode: backup.organization.production_mode,
        },
        users: backup.users.map(({ role, full_name, email }) => ({ role, full_name, email })).sort((a, b) => a.role.localeCompare(b.role)),
        production: backup.production.map((row) => ({
            id: row.id, worker_id: row.worker_id, machine_id: row.machine_id,
            meters: numeric(row.meters), date: row.date, shift: row.shift,
            worker_rate_snapshot: numeric(row.worker_rate_snapshot),
        })),
        stock: backup.stock.map((row) => ({
            id: row.id, quality_label: row.quality_label, godown: row.godown,
            original_meters: numeric(row.original_meters), available_meters: numeric(row.available_meters),
            cost_per_meter: numeric(row.cost_per_meter), source_type: row.source_type,
        })),
        receivables: backup.receivables.map((row) => ({
            id: row.id, source_type: row.source_type, source_id: row.source_id,
            party_name: row.party_name, quality_label: row.quality_label,
            total_amount: numeric(row.total_amount), received_amount: numeric(row.received_amount),
            balance_amount: numeric(row.balance_amount), payment_status: row.payment_status,
        })),
        payroll: backup.payroll.map((row) => ({
            id: row.id, worker_type: row.worker_type, meter_worker_id: row.meter_worker_id,
            month: row.month, cycle_start_date: row.cycle_start_date,
            gross_pay: numeric(row.gross_pay), advance_deducted: numeric(row.advance_deducted),
            net_payout: numeric(row.net_payout), carried_forward_debt: numeric(row.carried_forward_debt),
            status: row.status, payment_mode: row.payment_mode,
        })),
    }
}

function sha256(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function required(result, label) {
    const resolved = await result
    if (resolved.error) throw new Error(`${label}: ${resolved.error.message}`)
    return resolved.data
}

async function createAuthUsers(admin, suffix, phase) {
    const users = []
    for (const role of ['owner', 'supervisor']) {
        const email = `b18-${role}-${suffix}@qa.weavly.local`
        const password = `B18-${phase}-${role}-${suffix}-${crypto.randomBytes(8).toString('hex')}!`
        const created = await admin.auth.admin.createUser({
            email, password, email_confirm: true,
            user_metadata: { full_name: `B18 ${role === 'owner' ? 'Owner' : 'Supervisor'}` },
        })
        if (created.error || !created.data.user) throw new Error(`create ${phase} ${role}: ${created.error?.message}`)
        users.push({ id: created.data.user.id, email, password, role, full_name: `B18 ${role === 'owner' ? 'Owner' : 'Supervisor'}` })
    }
    return users
}

async function seedFixture(admin, suffix) {
    const users = await createAuthUsers(admin, suffix, 'seed')
    const owner = users.find((user) => user.role === 'owner')
    const orgId = crypto.randomUUID()
    await required(admin.from('organizations').insert({
        id: orgId, name: `B18 Recovery ${suffix}`, owner_id: owner.id,
        onboarding_complete: true, production_mode: 'both',
        join_code: `B18${suffix.slice(0, 6).toUpperCase()}`,
        join_code_expires_at: new Date(Date.now() + 3600000).toISOString(),
    }), 'seed organization')
    await required(admin.from('profiles').insert(users.map((user) => ({
        id: user.id, org_id: orgId, role: user.role,
        full_name: user.full_name, email: user.email,
    }))), 'seed profiles')
    const worker = await required(admin.from('workers').insert({
        org_id: orgId, name: 'B18 Restored Worker', is_active: true,
        date_of_birth: '1990-01-01', age_verification_method: 'government_id',
        age_verification_reference: `b18-${suffix}`, age_verified_at: new Date().toISOString(),
        age_verified_by: owner.id,
    }).select('id').single(), 'seed worker')
    const machine = await required(admin.from('machines').insert({
        org_id: orgId, name: 'B18 Recovery Loom', status: 'inactive', loom_type: 'rapier',
    }).select('id').single(), 'seed machine')
    const production = await required(admin.from('production_logs').insert({
        org_id: orgId, worker_id: worker.id, meter_worker_id: worker.id,
        machine_id: machine.id, meters: 120, date: '2026-07-14', shift: 'day',
        worker_rate_snapshot: 3.25, operator_worker_type: 'meter_worker',
        operator_pay_mode_snapshot: 'per_meter', operator_rate_snapshot: 3.25,
        machine_type_snapshot: 'rapier', created_by: owner.id, client_ip: 'b18-recovery-proof',
    }).select('id').single(), 'seed production')
    const stock = await required(admin.from('fabric_stock_lots').insert({
        org_id: orgId, quality_label: 'B18 Recovery Fabric', godown: 'B18 QA Godown',
        source_type: 'manual', original_taka_count: 2, available_taka_count: 1.5,
        meters_per_taka: 50, unit_label: 'taka', original_meters: 100,
        available_meters: 75, stock_purpose: 'manual', cost_per_meter: 22.5,
        received_date: '2026-07-14', notes: 'B18 sanitized backup fixture', created_by: owner.id,
    }).select('id').single(), 'seed stock')
    const sourceId = crypto.randomUUID()
    const receivable = await required(admin.from('commercial_receivables').insert({
        org_id: orgId, source_type: 'party_invoice', source_id: sourceId,
        source_date: '2026-07-14', party_name: 'B18 Recovery Buyer',
        quality_label: 'B18 Recovery Fabric', total_amount: 10000,
        received_amount: 2500, payment_status: 'partial',
        created_by: owner.id, updated_by: owner.id,
    }).select('id').single(), 'seed receivable')
    const payroll = await required(admin.from('payroll_settlements').insert({
        org_id: orgId, worker_type: 'meter', meter_worker_id: worker.id,
        month: '2026-07', cycle_start_date: '2026-07-01', gross_pay: 390,
        advance_deducted: 90, net_payout: 300, carried_forward_debt: 0,
        status: 'paid', payment_mode: 'cash',
    }).select('id').single(), 'seed payroll')
    return {
        orgId, users, ids: {
            worker: worker.id, machine: machine.id, production: production.id,
            stock: stock.id, receivable: receivable.id, payroll: payroll.id,
        },
    }
}

async function snapshot(admin, fixture) {
    const [organization, users, workers, machines, production, stock, receivables, payroll] = await Promise.all([
        required(admin.from('organizations').select('id,name,onboarding_complete,production_mode').eq('id', fixture.orgId).single(), 'snapshot organization'),
        required(admin.from('profiles').select('role,full_name,email').eq('org_id', fixture.orgId).order('role'), 'snapshot profiles'),
        required(admin.from('workers').select('id,name,is_active,date_of_birth,age_verification_method,age_verification_reference,age_verified_at').eq('org_id', fixture.orgId), 'snapshot workers'),
        required(admin.from('machines').select('id,name,status,loom_type').eq('org_id', fixture.orgId), 'snapshot machines'),
        required(admin.from('production_logs').select('id,worker_id,meter_worker_id,machine_id,meters,date,shift,worker_rate_snapshot,operator_worker_type,operator_pay_mode_snapshot,operator_rate_snapshot,machine_type_snapshot').eq('org_id', fixture.orgId), 'snapshot production'),
        required(admin.from('fabric_stock_lots').select('id,quality_label,godown,source_type,original_taka_count,available_taka_count,meters_per_taka,unit_label,original_meters,available_meters,stock_purpose,cost_per_meter,received_date,notes').eq('org_id', fixture.orgId), 'snapshot stock'),
        required(admin.from('commercial_receivables').select('id,source_type,source_id,source_date,party_name,quality_label,total_amount,received_amount,balance_amount,payment_status').eq('org_id', fixture.orgId), 'snapshot receivables'),
        required(admin.from('payroll_settlements').select('id,worker_type,meter_worker_id,month,cycle_start_date,gross_pay,advance_deducted,net_payout,carried_forward_debt,status,payment_mode').eq('org_id', fixture.orgId), 'snapshot payroll'),
    ])
    return { captured_at: new Date().toISOString(), project_ref: QA_REF, organization, users, workers, machines, production, stock, receivables, payroll }
}

async function removeFixture(admin, orgId, userIds) {
    const errors = []
    for (const table of ['payroll_settlements', 'commercial_receivables', 'fabric_stock_lots', 'production_logs', 'machines', 'workers', 'audit_log']) {
        const result = await admin.from(table).delete().eq('org_id', orgId)
        if (result.error) errors.push(`${table}: ${result.error.message}`)
    }
    const profiles = await admin.from('profiles').delete().eq('org_id', orgId)
    if (profiles.error) errors.push(`profiles: ${profiles.error.message}`)
    const organization = await admin.from('organizations').delete().eq('id', orgId)
    if (organization.error) errors.push(`organizations: ${organization.error.message}`)
    for (const userId of userIds) {
        const result = await admin.auth.admin.deleteUser(userId)
        if (result.error && result.error.code !== 'user_not_found') errors.push(`auth ${safeId(userId)}: ${result.error.message}`)
    }
    return errors
}

async function zeroReconciliation(admin, orgId, userIds) {
    const tables = ['organizations', 'profiles', 'workers', 'machines', 'production_logs', 'fabric_stock_lots', 'commercial_receivables', 'payroll_settlements']
    const pairs = await Promise.all(tables.map(async (table) => {
        const column = table === 'organizations' ? 'id' : 'org_id'
        const result = await admin.from(table).select('*', { count: 'exact', head: true }).eq(column, orgId)
        return [table, result.count ?? -1]
    }))
    const authReads = await Promise.all(userIds.map((id) => admin.auth.admin.getUserById(id)))
    return { ...Object.fromEntries(pairs), auth_users_exist: authReads.filter((item) => Boolean(item.data.user)).length }
}

async function cleanupStaleFixtures(admin) {
    const organizations = await required(
        admin.from('organizations').select('id').ilike('name', 'B18 Recovery %'),
        'find stale B18 fixtures',
    )
    const results = []
    for (const organization of organizations) {
        const profiles = await required(admin.from('profiles').select('id').eq('org_id', organization.id), 'find stale B18 users')
        const userIds = profiles.map((profile) => profile.id)
        const errors = await removeFixture(admin, organization.id, userIds)
        const reconciliation = await zeroReconciliation(admin, organization.id, userIds)
        results.push({ org_id: safeId(organization.id), errors, reconciliation })
    }
    return results
}

async function restoreFixture(admin, backup, suffix) {
    const users = await createAuthUsers(admin, suffix, 'restore')
    const owner = users.find((user) => user.role === 'owner')
    await required(admin.from('organizations').insert({
        ...backup.organization, owner_id: owner.id,
        join_code: `B18R${suffix.slice(0, 5).toUpperCase()}`,
        join_code_expires_at: new Date(Date.now() + 3600000).toISOString(),
    }), 'restore organization')
    await required(admin.from('profiles').insert(users.map((user) => ({
        id: user.id, org_id: backup.organization.id, role: user.role,
        full_name: user.full_name, email: user.email,
    }))), 'restore profiles')
    await required(admin.from('workers').insert(backup.workers.map((row) => ({
        ...row, org_id: backup.organization.id, age_verified_by: owner.id,
    }))), 'restore workers')
    await required(admin.from('machines').insert(backup.machines.map((row) => ({ ...row, org_id: backup.organization.id }))), 'restore machines')
    await required(admin.from('production_logs').insert(backup.production.map((row) => ({
        ...row, org_id: backup.organization.id, created_by: owner.id, client_ip: 'b18-restored',
    }))), 'restore production')
    await required(admin.from('fabric_stock_lots').insert(backup.stock.map((row) => ({
        ...row, org_id: backup.organization.id, created_by: owner.id,
    }))), 'restore stock')
    await required(admin.from('commercial_receivables').insert(backup.receivables.map((row) => {
        const restorable = { ...row }
        delete restorable.balance_amount
        return { ...restorable, org_id: backup.organization.id, created_by: owner.id, updated_by: owner.id }
    })), 'restore receivables')
    await required(admin.from('payroll_settlements').insert(backup.payroll.map((row) => ({
        ...row, org_id: backup.organization.id,
    }))), 'restore payroll')
    return { orgId: backup.organization.id, users }
}

async function main() {
    const env = { ...process.env, ...parseEnv(await fs.readFile(path.join(root, '.env.qa.local'), 'utf8')) }
    if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(QA_REF) || !env.SUPABASE_SERVICE_ROLE_KEY || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('B18 refused: exact QA project and credentials were not proven.')
    }
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const assertions = []
    const suffix = crypto.randomBytes(5).toString('hex')
    const evidence = {
        run_id: `B18-QA-RESTORE-${Date.now()}`,
        environment: 'isolated-qa-logical-restore', project_ref: QA_REF,
        sanitized_fixture: true, production_mutated: false,
        assertions, cleanup: 'pending', passed: false,
    }
    let fixture = null
    let activeUserIds = []
    try {
        evidence.preflight_cleanup = await cleanupStaleFixtures(admin)
        fixture = await seedFixture(admin, suffix)
        activeUserIds = fixture.users.map((user) => user.id)
        const backup = await snapshot(admin, fixture)
        const beforeSummary = canonicalSummary(backup)
        const backupHash = sha256(beforeSummary)
        await fs.mkdir(path.dirname(privateBackupPath), { recursive: true })
        await fs.writeFile(privateBackupPath, `${JSON.stringify(backup, null, 2)}\n`, { mode: 0o600 })
        evidence.backup_manifest = {
            format: 'sanitized logical JSON', captured_at: backup.captured_at,
            sha256: backupHash, tables: ['organizations', 'profiles', 'workers', 'machines', 'production_logs', 'fabric_stock_lots', 'commercial_receivables', 'payroll_settlements'],
            counts: {
                organizations: 1, users: backup.users.length, production: backup.production.length,
                stock: backup.stock.length, receivables: backup.receivables.length, payroll: backup.payroll.length,
            },
        }
        assertCondition(assertions, 'sanitized backup contains every required recovery domain',
            backup.users.length === 2 && backup.production.length === 1 && backup.stock.length === 1
            && backup.receivables.length === 1 && backup.payroll.length === 1, evidence.backup_manifest.counts)

        const deleteErrors = await removeFixture(admin, fixture.orgId, activeUserIds)
        const afterDelete = await zeroReconciliation(admin, fixture.orgId, activeUserIds)
        assertCondition(assertions, 'simulated loss removes the complete disposable fixture before restore',
            deleteErrors.length === 0 && Object.values(afterDelete).every((value) => value === 0), { delete_errors: deleteErrors, reconciliation: afterDelete })
        activeUserIds = []

        const privateBackup = JSON.parse(await fs.readFile(privateBackupPath, 'utf8'))
        const restoreStarted = performance.now()
        const restored = await restoreFixture(admin, privateBackup, suffix)
        const restoreDurationMs = Math.round((performance.now() - restoreStarted) * 100) / 100
        activeUserIds = restored.users.map((user) => user.id)
        const afterBackup = await snapshot(admin, restored)
        const afterSummary = canonicalSummary(afterBackup)
        const restoredHash = sha256(afterSummary)
        assertCondition(assertions, 'restored organization users production stock receivable and payroll reconcile exactly',
            restoredHash === backupHash, { backup_sha256: backupHash, restored_sha256: restoredHash, restore_duration_ms: restoreDurationMs })

        const owner = restored.users.find((user) => user.role === 'owner')
        const sessionClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
        const signIn = await sessionClient.auth.signInWithPassword({ email: owner.email, password: owner.password })
        assertCondition(assertions, 'restored owner identity is usable after credential rotation',
            !signIn.error && Boolean(signIn.data.user), { signed_in: !signIn.error, restored_user_id: safeId(signIn.data.user?.id) })
        await sessionClient.auth.signOut()

        evidence.restore = {
            target: 'existing isolated QA project because Free-plan branch/new-project creation was unavailable',
            restore_duration_ms: restoreDurationMs, backup_sha256: backupHash,
            restored_sha256: restoredHash, summary: afterSummary,
        }
        evidence.passed = assertions.every((assertion) => assertion.passed)
        const cleanupErrors = await removeFixture(admin, restored.orgId, activeUserIds)
        const cleanupReconciliation = await zeroReconciliation(admin, restored.orgId, activeUserIds)
        activeUserIds = []
        evidence.cleanup = cleanupErrors.length === 0 && Object.values(cleanupReconciliation).every((value) => value === 0) ? 'complete' : 'failed'
        evidence.cleanup_result = { errors: cleanupErrors, reconciliation: cleanupReconciliation }
        evidence.passed = evidence.passed && evidence.cleanup === 'complete'
        await fs.rm(privateBackupPath, { force: true })
        await fs.mkdir(path.dirname(outputPath), { recursive: true })
        await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
        process.stdout.write(`${JSON.stringify({ path: outputPath, passed: evidence.passed, assertions: assertions.length, cleanup: evidence.cleanup }, null, 2)}\n`)
        if (!evidence.passed) process.exitCode = 1
    } catch (error) {
        const orgId = fixture?.orgId
        const cleanupErrors = orgId ? await removeFixture(admin, orgId, activeUserIds) : []
        const cleanupReconciliation = orgId ? await zeroReconciliation(admin, orgId, activeUserIds) : null
        await fs.rm(privateBackupPath, { force: true })
        evidence.error = String(error?.message ?? error)
        evidence.passed = false
        evidence.cleanup = cleanupReconciliation && cleanupErrors.length === 0 && Object.values(cleanupReconciliation).every((value) => value === 0) ? 'complete_after_failure' : 'failed_after_failure'
        evidence.cleanup_result = { errors: cleanupErrors, reconciliation: cleanupReconciliation }
        await fs.mkdir(path.dirname(outputPath), { recursive: true })
        await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
        throw error
    }
}

await main()
