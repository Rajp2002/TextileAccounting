import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asSuperuser, asUser, freshDatabase, seedOwnerOrg, type Db } from './helpers'

// Fix package F1 (OS-3): delivery challans move to History (archived_at) when
// fully received with no open difference and a zero balance, or when the
// dispatch is reversed; migration 20260926132412 restores the rule from
// 20260909045727. Stock effects are asserted alongside (E10 O-INV-06/08).

let db: Db
let owner: { userId: string; orgId: string }
let qualityId: string

async function mutate(challanId: string, action: string, payload: object) {
    await asUser(db, owner.userId, owner.orgId)
    const { rows: [current] } = await db.query('SELECT version FROM public.delivery_challans WHERE id = $1', [challanId])
    await db.query('SELECT public.mutate_delivery_challan($1, $2, $3, $4, $5)', [challanId, randomUUID(), current?.version ?? 0, action, payload])
}

/** A confirmed challan: 40 m at ₹50/m (₹2,000 chargeable). */
async function sentChallan() {
    const id = randomUUID()
    await mutate(id, 'save', {
        quality_id: qualityId,
        selling_rate: 50,
        lines: [{ lot: `LOT-${id.slice(0, 6)}`, meters: 40 }],
        document: {
            sender_name: 'Test Weaving Works', sender_address: 'Surat',
            customer_name: 'Test Party', customer_address: 'Surat',
            delivery_address: 'Surat', date: '2026-09-26',
        },
    })
    await mutate(id, 'confirm', {})
    return id
}

async function challan(id: string) {
    await asSuperuser(db)
    const { rows: [row] } = await db.query(
        'SELECT delivery_status, difference_status, balance::float8 AS balance, archived_at IS NOT NULL AS archived FROM public.delivery_challans WHERE id = $1',
        [id],
    )
    return row as { delivery_status: string; difference_status: string; balance: number; archived: boolean }
}

async function fabricMeters() {
    await asSuperuser(db)
    const { rows: [row] } = await db.query('SELECT meters::float8 AS meters FROM public.quality_stock WHERE id = $1', [qualityId])
    return row.meters as number
}

const payment = (amount: number) => ({ amount, method: 'bank_transfer', date: '2026-09-26', reason: 'UTR 123456' })

beforeAll(async () => {
    db = await freshDatabase()
    owner = await seedOwnerOrg(db, { tier: 'base' })
    await asUser(db, owner.userId, owner.orgId)
    await db.query("SELECT public.record_quality_stock_adjustment('Cotton Poplin', 1000, 'opening', 'Physical count', $1)", [randomUUID()])
    await asSuperuser(db)
    const { rows: [quality] } = await db.query("SELECT id FROM public.quality_stock WHERE org_id = $1 AND quality_key = 'cotton poplin'", [owner.orgId])
    qualityId = quality.id
})
afterAll(async () => { await db?.end() })

describe('delivery challan archiving (OS-3 fixed)', () => {
    it('INVARIANT: a reversed dispatch restores the fabric and moves to History', async () => {
        const before = await fabricMeters()
        const id = await sentChallan()
        expect(await fabricMeters()).toBe(before - 40)
        await mutate(id, 'reverse_dispatch', { reason: 'Returned before delivery', stock_present: true })
        expect(await challan(id)).toMatchObject({ delivery_status: 'reversed', archived: true })
        expect(await fabricMeters()).toBe(before)
    })

    it('INVARIANT: a challan fully received and fully paid moves to History', async () => {
        const id = await sentChallan()
        await mutate(id, 'receipt', { meters: 40 })
        expect(await challan(id)).toMatchObject({ delivery_status: 'received', difference_status: 'none', balance: 2000, archived: false })
        await mutate(id, 'payment', payment(2000))
        expect(await challan(id)).toMatchObject({ balance: 0, archived: true })
    })

    it('INVARIANT: a partly paid challan stays open', async () => {
        const id = await sentChallan()
        await mutate(id, 'receipt', { meters: 40 })
        await mutate(id, 'payment', payment(1500))
        expect(await challan(id)).toMatchObject({ balance: 500, archived: false })
    })

    it('INVARIANT: reversing the settling payment brings the challan back from History', async () => {
        const id = await sentChallan()
        await mutate(id, 'receipt', { meters: 40 })
        await mutate(id, 'payment', payment(2000))
        await asSuperuser(db)
        const { rows: [event] } = await db.query("SELECT id FROM public.delivery_challan_events WHERE challan_id = $1 AND action = 'payment'", [id])
        await mutate(id, 'reverse_entry', { event_id: event.id, reason: 'Cheque bounced' })
        expect(await challan(id)).toMatchObject({ balance: 2000, archived: false })
    })

    it('INVARIANT: a receipt short of the sent metres keeps the challan open for review', async () => {
        const id = await sentChallan()
        await mutate(id, 'receipt', { meters: 35 })
        await mutate(id, 'payment', payment(2000))
        expect(await challan(id)).toMatchObject({ difference_status: 'review', balance: 0, archived: false })
    })
})
