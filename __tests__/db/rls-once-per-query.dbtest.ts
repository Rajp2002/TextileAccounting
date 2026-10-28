import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asSuperuser, asUser, freshDatabase, seedOwnerOrg, type Db } from './helpers'

// Migration 20261028120000 evaluates the Free business boundary and the costing
// tables' plan check once per query instead of once per row. These tests pin
// the behaviour it must keep: who can read and write which rows. They pass on
// the policies before that migration too, except the two that need it (the
// once-per-query function, and the plan showing initplans).

let db: Db
type Owner = { userId: string; orgId: string }
let freeOwner: Owner // a Free account: Free grant, no paid plan
let liteFromFree: Owner // upgraded from Free: Free grant and a Lite plan
let lite: Owner // Lite without a Free past

async function grantFree(owner: Owner) {
    await asSuperuser(db)
    await db.query('INSERT INTO public.free_account_subjects(id, active, verified_at, beta_allowed) VALUES ($1, true, now(), true)', [owner.userId])
    await db.query('INSERT INTO public.free_account_grants(org_id, subject_id) VALUES ($1, $2)', [owner.orgId, owner.userId])
}

// A row with every NOT NULL column filled, seeded without triggers.
async function insertRow(table: string, values: Record<string, unknown>) {
    await asSuperuser(db)
    const { rows: columns } = await db.query(`
        SELECT column_name, udt_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND is_nullable = 'NO' AND column_default IS NULL AND is_identity = 'NO'`, [table])
    const row: Record<string, unknown> = { ...values }
    for (const { column_name: name, udt_name: type } of columns) {
        if (name in row) continue
        row[name] = type === 'uuid' ? randomUUID() : /int|numeric|float/.test(type) ? 1 : type === 'bool' ? false : /json/.test(type) ? {} : type === 'date' ? '2026-10-01' : /timestamp/.test(type) ? new Date().toISOString() : `seed-${name}`
    }
    const names = Object.keys(row)
    await db.query('SET session_replication_role = replica')
    await db.query(`INSERT INTO public.${table} (${names.join(', ')}) VALUES (${names.map((_, index) => `$${index + 1}`).join(', ')})`, Object.values(row))
    await db.query('SET session_replication_role = origin')
}

async function visible(owner: Owner, table: string) {
    await asUser(db, owner.userId, owner.orgId)
    const { rows } = await db.query(`SELECT org_id FROM public.${table}`)
    await asSuperuser(db)
    return rows.map((row: { org_id: string }) => row.org_id).sort()
}

beforeAll(async () => {
    db = await freshDatabase()
    freeOwner = await seedOwnerOrg(db, { tier: null })
    liteFromFree = await seedOwnerOrg(db, { tier: 'lite' })
    lite = await seedOwnerOrg(db, { tier: 'lite' })
    await grantFree(freeOwner)
    await grantFree(liteFromFree)
    for (const owner of [freeOwner, liteFromFree, lite]) {
        await insertRow('estimator_quotes', { org_id: owner.orgId, record_kind: 'costing', status: 'draft', reconciliation_status: 'verified', version_number: 1 })
        await insertRow('estimator_templates', { org_id: owner.orgId, name: `Quality ${owner.orgId.slice(0, 4)}` })
        // Readable by its owner, with the Free boundary as the only other check.
        await insertRow('organization_billing_profiles', {
            org_id: owner.orgId, legal_name: 'Test Weaving Works', address_line1: 'Ring Road', city: 'Surat',
            state: 'Gujarat', state_code: '24', postal_code: '395002', billing_email: 'owner@example.test',
        })
    }
})

afterAll(async () => {
    await db?.end()
})

describe('Free business boundary, evaluated once per query', () => {
    it('gives the same answer as the per-row check for every caller and row org', async () => {
        const anonymous = { userId: randomUUID(), orgId: randomUUID() }
        for (const caller of [freeOwner, liteFromFree, lite, anonymous]) {
            await asUser(db, caller.userId, caller.orgId)
            for (const rowOrg of [freeOwner.orgId, liteFromFree.orgId, lite.orgId, null]) {
                const { rows: [result] } = await db.query(`
                    SELECT NOT weavly_private.free_business_restricted($1::uuid) AS per_row,
                           NOT coalesce($1::uuid = (SELECT weavly_private.free_business_restricted_org()), false) AS once_per_query`, [rowOrg])
                expect({ caller: caller.orgId, rowOrg, allowed: result.once_per_query }).toEqual({ caller: caller.orgId, rowOrg, allowed: result.per_row })
            }
        }
        await asSuperuser(db)
    })

    it('still hides a Free account its own business rows and leaves upgraded accounts theirs', async () => {
        expect(await visible(freeOwner, 'organization_billing_profiles')).toEqual([])
        expect(await visible(liteFromFree, 'organization_billing_profiles')).toEqual([liteFromFree.orgId])
        expect(await visible(lite, 'organization_billing_profiles')).toEqual([lite.orgId])
    })

    it('still refuses a Free account writes to business tables', async () => {
        await asUser(db, freeOwner.userId, freeOwner.orgId)
        await expect(db.query("INSERT INTO public.estimator_templates(org_id, name) VALUES ($1, 'Free attempt')", [freeOwner.orgId])).rejects.toThrow(/row-level security/)
        await asSuperuser(db)
    })
})

describe('Saved costings and qualities, plan checked once per query', () => {
    it('shows each paid owner their own costings and saved qualities only', async () => {
        for (const owner of [liteFromFree, lite]) {
            expect(await visible(owner, 'estimator_quotes')).toEqual([owner.orgId])
            expect(await visible(owner, 'estimator_templates')).toEqual([owner.orgId])
        }
        expect(await visible(freeOwner, 'estimator_quotes')).toEqual([])
        expect(await visible(freeOwner, 'estimator_templates')).toEqual([])
    })

    it('evaluates the checks in initplans, not per row', async () => {
        await asUser(db, lite.userId, lite.orgId)
        const { rows } = await db.query('EXPLAIN (FORMAT TEXT) SELECT id FROM public.estimator_quotes')
        await asSuperuser(db)
        const plan = rows.map((row: { 'QUERY PLAN': string }) => row['QUERY PLAN']).join('\n')
        expect(plan).not.toMatch(/free_business_restricted\(org_id\)/)
        expect(plan).not.toMatch(/org_has_subscription_tier\(org_id/)
    })
})
