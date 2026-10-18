import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { f1State } from '../fixtures/costing-characterization'
import { asSuperuser, freshDatabase, seedOwnerOrg, type Db } from './helpers'
import { createTestSupabase, type RpcCall } from './supabase-adapter'

// A Saved Quality and the costings that share its name form one lineage. A
// costing saved before its quality existed has no template link; the quality
// must adopt it, so the next save is version 2 of that same costing.

type Actor = { userId: string; orgId: string }
const ctx = vi.hoisted(() => ({ db: undefined as unknown, actor: undefined as unknown, calls: [] as unknown[] }))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))
vi.mock('@/lib/auth', () => ({
    requireRole: async () => {
        const actor = ctx.actor as Actor
        return { user: { id: actor.userId }, profile: { id: actor.userId, org_id: actor.orgId, role: 'owner' } }
    },
}))
vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => {
        const actor = ctx.actor as Actor
        return createTestSupabase(ctx.db as Db, { kind: 'user', ...actor }, ctx.calls as RpcCall[])
    },
}))
vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: () => createTestSupabase(ctx.db as Db, { kind: 'service' }, ctx.calls as RpcCall[]),
}))

const { saveAsFabricTemplate, saveEstimatorQuoteV3 } = await import('@/app/(dashboard)/owner/estimator/actions')

let db: Db

const PRICE: Record<number, number> = { 12: 31.44, 13: 31.82 }
const atMargin = (profitPct: number) => ({ estimate: f1State({ profitPct }), totalProductionCostPerM: 26.23, quotePricePerM: PRICE[profitPct] })

function qualityInput(name: string, profitPct: number) {
    const estimate = f1State({ profitPct })
    return {
        name, warpRows: estimate.warpRows, weftRows: estimate.weftRows, tapeLengthM: estimate.tapeLengthM,
        warpCrimpPct: estimate.warpCrimpPct, perPickCostPaisa: estimate.perPickCostPaisa, yarnShortagePct: estimate.yarnShortagePct,
        overheadMode: estimate.overheadMode, overheadOverridePerM: estimate.overheadOverridePerM,
        loomType: estimate.loomType, loomRpm: estimate.loomRpm, loomPowerKw: estimate.loomPowerKw,
        warpingMode: estimate.warpingMode, sizingMode: estimate.sizingMode, hoursPerShift: estimate.hoursPerShift, estimate,
    }
}

type LineageRow = { id: string; quality_label: string; template_id: string | null; costing_group_id: string | null; version_number: number }

async function costingRows(orgId: string) {
    await asSuperuser(db)
    const { rows } = await db.query(
        `SELECT id, quality_label, template_id, costing_group_id, version_number
           FROM public.estimator_quotes
          WHERE org_id = $1 AND record_kind = 'costing'
          ORDER BY created_at, version_number`,
        [orgId],
    )
    return rows as LineageRow[]
}

async function templateUpdatedAt(orgId: string, name: string) {
    await asSuperuser(db)
    const { rows: [template] } = await db.query(
        `SELECT id, updated_at FROM public.estimator_templates WHERE org_id = $1 AND name = $2`,
        [orgId, name],
    )
    return template as { id: string; updated_at: string }
}

// Saves a costing the way it existed before quality links were written: the
// link triggers are off for this one insert, so template_id stays NULL.
async function saveLegacyCosting(actor: Actor, qualityLabel: string) {
    ctx.actor = actor
    await asSuperuser(db)
    await db.query('SET session_replication_role = replica')
    const saved = await saveEstimatorQuoteV3({ clientRequestId: randomUUID(), qualityLabel, ...atMargin(12), recordKind: 'costing' })
    await asSuperuser(db)
    await db.query('SET session_replication_role = origin')
    return saved
}

beforeAll(async () => {
    db = await freshDatabase()
    ctx.db = db
})
afterAll(async () => { await db?.end() })

describe('costing lineage: a costing saved before its quality', () => {
    it('is adopted by the quality rather than copied, and the next update is its version 2', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'lite', name: 'Legacy Weaver' })
        const actor = { userId: owner.userId, orgId: owner.orgId }
        const original = await saveLegacyCosting(actor, 'Silk')
        expect(original).toMatchObject({ success: true, versionNumber: 1 })

        ctx.actor = actor
        const quality = await saveAsFabricTemplate(qualityInput('Silk', 12))
        expect(quality).toMatchObject({ success: true, quoteId: original.quoteId })
        expect(await costingRows(owner.orgId)).toHaveLength(1)

        const template = await templateUpdatedAt(owner.orgId, 'Silk')
        ctx.actor = actor
        const updated = await saveEstimatorQuoteV3({
            clientRequestId: randomUUID(), qualityLabel: 'Silk', ...atMargin(13),
            templateId: template.id, expectedTemplateUpdatedAt: template.updated_at,
        })
        expect(updated).toMatchObject({ success: true, versionNumber: 2 })

        const rows = await costingRows(owner.orgId)
        expect(rows).toHaveLength(2)
        expect(rows.map(row => row.version_number)).toEqual([1, 2])
        expect(new Set(rows.map(row => row.costing_group_id)).size).toBe(1)
        expect(rows[0].id).toBe(original.quoteId)
        expect(rows[1]).toMatchObject({ id: updated.quoteId, template_id: template.id, version_number: 2 })
    })

    it('adopts it as version 2 when the quality was saved with changed inputs', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'lite', name: 'Changed Inputs Weaver' })
        const actor = { userId: owner.userId, orgId: owner.orgId }
        const original = await saveLegacyCosting(actor, 'Voile')

        ctx.actor = actor
        const quality = await saveAsFabricTemplate(qualityInput('Voile', 13))
        expect(quality).toMatchObject({ success: true, versionNumber: 2 })
        expect(quality.quoteId).not.toBe(original.quoteId)

        const rows = await costingRows(owner.orgId)
        expect(rows.map(row => row.version_number)).toEqual([1, 2])
        expect(new Set(rows.map(row => row.costing_group_id)).size).toBe(1)
        expect(rows[1]).toMatchObject({ template_id: quality.templateId })
    })

    it('is not adopted by a quality with a different name', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'lite', name: 'Different Name Weaver' })
        const actor = { userId: owner.userId, orgId: owner.orgId }
        await saveLegacyCosting(actor, 'Silk')

        ctx.actor = actor
        const quality = await saveAsFabricTemplate(qualityInput('Cotton', 12))
        expect(quality).toMatchObject({ success: true, versionNumber: 1 })

        const rows = await costingRows(owner.orgId)
        expect(rows).toHaveLength(2)
        expect(new Set(rows.map(row => row.costing_group_id)).size).toBe(2)
    })
})

describe('costing lineage: a quality saved first', () => {
    it('keeps every later update in one lineage', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'lite', name: 'Quality First Weaver' })
        const actor = { userId: owner.userId, orgId: owner.orgId }

        ctx.actor = actor
        const quality = await saveAsFabricTemplate(qualityInput('Linen', 12))
        expect(quality).toMatchObject({ success: true, versionNumber: 1 })

        const template = await templateUpdatedAt(owner.orgId, 'Linen')
        ctx.actor = actor
        const updated = await saveEstimatorQuoteV3({
            clientRequestId: randomUUID(), qualityLabel: 'Linen', ...atMargin(13),
            templateId: template.id, expectedTemplateUpdatedAt: template.updated_at,
        })
        expect(updated).toMatchObject({ success: true, versionNumber: 2 })

        const rows = await costingRows(owner.orgId)
        expect(rows.map(row => row.version_number)).toEqual([1, 2])
        expect(new Set(rows.map(row => row.costing_group_id)).size).toBe(1)
    })

    it('refuses a costing whose fabric differs from its quality', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'lite', name: 'Different Fabric Weaver' })
        const actor = { userId: owner.userId, orgId: owner.orgId }

        ctx.actor = actor
        await saveAsFabricTemplate(qualityInput('Linen', 12))
        const template = await templateUpdatedAt(owner.orgId, 'Linen')

        const base = atMargin(12).estimate
        const estimate = { ...base, warpRows: base.warpRows.map((row, index) => index === 0 ? { ...row, beamEnds: row.beamEnds + 400 } : row) }
        ctx.actor = actor
        const refused = await saveEstimatorQuoteV3({
            clientRequestId: randomUUID(), qualityLabel: 'Linen', estimate,
            totalProductionCostPerM: 26.23, quotePricePerM: PRICE[12],
            templateId: template.id, expectedTemplateUpdatedAt: template.updated_at,
        })
        expect(refused).toMatchObject({ error: expect.stringContaining('different fabric from Linen') })
        expect(await costingRows(owner.orgId)).toHaveLength(1)
    })
})
