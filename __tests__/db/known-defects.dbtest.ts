import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

// Refactor Package 1B-1. KNOWN DEFECT tests assert today's (wrong) behavior
// so it is visible and reproducible; each flips when a separately approved
// fix lands. See docs/maintenance/weavly-refactor/EVIDENCE.md E10/E12.

let db: Db
let owner: { userId: string; orgId: string }

beforeAll(async () => {
    db = await freshDatabase()
    owner = await seedOwnerOrg(db, { tier: 'base' })
})
afterAll(async () => { await db?.end() })

describe('known Base stock defects', () => {
    it('KNOWN DEFECT OS-1: the inventory audit RPC fails for every entitled owner with nested aggregates', async () => {
        await asUser(db, owner.userId, owner.orgId)
        const error = await pgError(db.query('SELECT public.get_inventory_audit_data(current_date, NULL)'))
        expect(error.code).toBe('42803')
        expect(error.message).toBe('aggregate function calls cannot be nested')
    })

    it('KNOWN DEFECT OS-2: owners cannot create inventory audits, although the server action inserts them directly', async () => {
        await asUser(db, owner.userId, owner.orgId)
        const error = await pgError(db.query('INSERT INTO public.inventory_audits(org_id) VALUES ($1)', [owner.orgId]))
        expect(error.code).toBe('42501')
        expect(error.message).toBe('permission denied for table inventory_audits')
    })

    it('KNOWN DEFECT OS-3: a reversed challan is no longer archived (the 2026-09-09 version set archived_at)', async () => {
        await asUser(db, owner.userId, owner.orgId)
        await db.query(
            "SELECT public.record_quality_stock_adjustment('Cotton Poplin', 100, 'opening', 'Physical count', $1)",
            [randomUUID()],
        )
        const { rows: [quality] } = await db.query("SELECT id FROM public.quality_stock WHERE quality_key = 'cotton poplin'")
        const challanId = randomUUID()
        const mutate = async (action: string, payload: object) => {
            const { rows: [current] } = await db.query('SELECT version FROM public.delivery_challans WHERE id = $1', [challanId])
            return db.query('SELECT public.mutate_delivery_challan($1, $2, $3, $4, $5)', [challanId, randomUUID(), current?.version ?? 0, action, payload])
        }

        await mutate('save', {
            quality_id: quality.id,
            selling_rate: 50,
            lines: [{ lot: 'LOT-1', meters: 40 }],
            document: {
                sender_name: 'Test Weaving Works', sender_address: 'Surat',
                customer_name: 'Test Party', customer_address: 'Surat',
                delivery_address: 'Surat', date: '2026-09-26',
            },
        })
        await mutate('confirm', {})
        await mutate('reverse_dispatch', { reason: 'Returned before delivery', stock_present: true })

        const { rows: [challan] } = await db.query('SELECT delivery_status, archived_at FROM public.delivery_challans WHERE id = $1', [challanId])
        const { rows: [stock] } = await db.query("SELECT meters::float8 AS meters FROM public.quality_stock WHERE quality_key = 'cotton poplin'")
        expect(challan.delivery_status).toBe('reversed')
        expect(stock.meters).toBe(100) // INVARIANT O-INV-06: reversal restores the fabric
        expect(challan.archived_at).toBeNull() // KNOWN DEFECT: should be archived and shown in History
    })
})
