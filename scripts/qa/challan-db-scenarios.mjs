import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
export async function testChallans({
    admin,
    a,
    b,
    outsider,
    floor,
    org,
    test,
}) {
    await admin.query(
        readFileSync(
            'supabase/migrations/20260908235614_standalone_delivery_challans.sql',
            'utf8',
        ),
    )
    const quality = (
        await admin.query(
            "select id from quality_stock where org_id=$1 and quality_key='cotton'",
            [org],
        )
    ).rows[0].id
    const body = {
        quality_id: quality,
        selling_rate: 40,
        document: {
            date: '2026-09-09',
            sender_name: 'Test sender',
            sender_address: 'Surat',
            customer_name: 'Independent customer',
            customer_address: 'Ahmedabad',
            delivery_address: 'Warehouse',
        },
        lines: [75, 70, 85, 92, 88, 77, 98].map((meters, i) => ({
            lot: String(89895 + i),
            meters,
        })),
    }
    const call = (
        db,
        id,
        version,
        action,
        payload = {},
        request = randomUUID(),
    ) =>
        db.query('select mutate_delivery_challan($1,$2,$3,$4,$5) result', [
            id,
            request,
            version,
            action,
            payload,
        ])
    const get = async (id) =>
        (await a.query('select * from delivery_challans where id=$1', [id]))
            .rows[0]
    const stock = async () =>
        Number(
            (
                await a.query('select meters from quality_stock where id=$1', [
                    quality,
                ])
            ).rows[0].meters,
        )
    const balance = async (id) => Number((await get(id)).balance)
    const act = async (id, action, payload = {}) =>
        call(a, id, (await get(id)).version, action, payload)
    const financial = (amount) => ({
        amount,
        date: '2026-09-09',
        method: 'bank',
        reason: 'Bank reference 123',
    })
    const create = async (payload = body) => {
        const id = randomUUID()
        await call(a, id, 0, 'save', payload)
        return id
    }
    const setStock = async (m) =>
        a.query(
            "select record_quality_stock_adjustment('Cotton',$1,'correction','Local test stock',$2,$3)",
            [m, randomUUID(), await stock()],
        )
    let id
    await test('challan draft and edited lines do not debit stock; rate is explicit', async () => {
        await setStock(1000)
        id = await create()
        assert.equal(await stock(), 1000)
        assert.equal(Number((await get(id)).sent_meters), 585)
        assert.equal(await balance(id), 23400)
        await act(id, 'save', {
            ...body,
            document: { ...body.document, notes: 'Reviewed' },
        })
        assert.equal(await stock(), 1000)
    })
    await test('concurrent identical confirmation retries debit once and link movement', async () => {
        const d = await get(id),
            request = randomUUID()
        await Promise.all([
            call(a, id, d.version, 'confirm', {}, request),
            call(b, id, d.version, 'confirm', {}, request),
        ])
        assert.equal(await stock(), 415)
        assert.equal(
            (
                await a.query(
                    "select * from quality_stock_movements where source_id=$1 and kind='dispatch'",
                    [id],
                )
            ).rowCount,
            1,
        )
        await assert.rejects(
            call(a, id, d.version, 'confirm', { changed: true }, request),
            /different details/,
        )
        await assert.rejects(
            act(id, 'save', { ...body, selling_rate: 99 }),
            /issued/,
        )
        assert.equal(Number((await get(id)).selling_rate), 40)
    })
    await test('insufficient stock rejects atomically and preserves draft', async () => {
        const fail = await create()
        await assert.rejects(act(fail, 'confirm'), /Insufficient stock/)
        assert.equal((await get(fail)).delivery_status, 'draft')
        assert.equal(await stock(), 415)
    })
    await test('receipt shortage never returns stock; disputed paid dispatch stays active', async () => {
        await act(id, 'receipt', {
            meters: 583,
            evidence: 'https://example.com/receipt.pdf',
        })
        assert.equal(await stock(), 415)
        assert.equal(await balance(id), 23400)
        await act(id, 'resolve', {
            decision: 'disputed',
            reason: 'Review signed receipt',
        })
        await act(id, 'payment', financial(23400))
        assert.equal(await balance(id), 0)
        assert.equal((await get(id)).archived_at, null)
    })
    await test('accepted shortage after payment creates credit; explicit refund archives', async () => {
        await act(id, 'resolve', {
            decision: 'accepted',
            reason: 'Accept confirmed measurement',
        })
        assert.equal(await balance(id), -80)
        assert.equal(Number((await get(id)).sent_meters), 585)
        assert.equal(Number((await get(id)).chargeable_meters), 583)
        assert.equal(await stock(), 415)
        assert.equal((await get(id)).archived_at, null)
        await assert.rejects(act(id, 'refund', financial(81)), /exceed/)
        await act(id, 'refund', financial(80))
        assert.equal(await balance(id), 0)
        assert.ok((await get(id)).archived_at)
    })
    await test('post-archive receipt correction reopens and preserves payment history', async () => {
        await act(id, 'receipt', {
            meters: 585,
            reason: 'Corrected signed receipt',
        })
        assert.equal(await balance(id), 80)
        assert.equal((await get(id)).archived_at, null)
        await act(id, 'payment', financial(30))
        await act(id, 'payment', financial(50))
        assert.ok((await get(id)).archived_at)
    })
    await test('payment retries cannot duplicate and reversal reopens settled dispatch', async () => {
        const pay = (
            await a.query(
                "select * from delivery_challan_events where challan_id=$1 and action='payment' and amount=50",
                [id],
            )
        ).rows[0]
        const ver = (await get(id)).version,
            request = randomUUID()
        await call(
            a,
            id,
            ver,
            'reverse_entry',
            { event_id: pay.id, reason: 'Payment entered twice' },
            request,
        )
        await call(
            a,
            id,
            ver,
            'reverse_entry',
            { event_id: pay.id, reason: 'Payment entered twice' },
            request,
        )
        assert.equal(await balance(id), 50)
        assert.equal((await get(id)).archived_at, null)
        await assert.rejects(
            act(id, 'reverse_entry', { event_id: pay.id, reason: 'Again' }),
            /already reversed/,
        )
        const version = (await get(id)).version,
            req = randomUUID()
        await Promise.all([
            call(a, id, version, 'payment', financial(50), req),
            call(b, id, version, 'payment', financial(50), req),
        ])
        assert.equal(await balance(id), 0)
    })
    await test('charge/credit adjustments and their reversal preserve audit and reopen safely', async () => {
        await act(id, 'adjustment', { amount: 120, reason: 'Transport charge' })
        assert.equal(await balance(id), 120)
        assert.equal((await get(id)).archived_at, null)
        const event = (
            await a.query(
                "select * from delivery_challan_events where challan_id=$1 and action='adjustment'",
                [id],
            )
        ).rows[0]
        await act(id, 'reverse_entry', {
            event_id: event.id,
            reason: 'Charge was included',
        })
        assert.equal(await balance(id), 0)
        assert.ok((await get(id)).archived_at)
        await assert.rejects(
            act(id, 'adjustment', {
                amount: -999999,
                reason: 'Invalid credit',
            }),
            /negative/,
        )
    })
    await test('two concurrent dispatches cannot overspend quality stock', async () => {
        await setStock(1000)
        const first = await create(),
            second = await create()
        const results = await Promise.allSettled([
            call(a, first, 1, 'confirm'),
            call(b, second, 1, 'confirm'),
        ])
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
        assert.equal(await stock(), 415)
    })
    await test('reversal requires physical stock affirmation and immutable financial-free history', async () => {
        await setStock(1000)
        const reverse = await create()
        await act(reverse, 'confirm')
        assert.equal(await stock(), 415)
        await assert.rejects(
            act(reverse, 'reverse_dispatch', { reason: 'Wrong dispatch' }),
            /physically/,
        )
        await act(reverse, 'reverse_dispatch', {
            reason: 'Never left warehouse',
            stock_present: true,
        })
        assert.equal(await stock(), 1000)
        assert.equal((await get(reverse)).delivery_status, 'reversed')
        await assert.rejects(
            act(reverse, 'reverse_dispatch', {
                reason: 'Again',
                stock_present: true,
            }),
            /Only unreceived/,
        )
        assert.equal(await stock(), 1000)
        await assert.rejects(
            act(id, 'reverse_dispatch', {
                reason: 'Paid transaction',
                stock_present: true,
            }),
            /Only unreceived/,
        )
    })
    await test('receipt acceptance cannot make charges negative after a credit adjustment', async () => {
        await setStock(1000)
        const adjusted = await create()
        await act(adjusted, 'confirm')
        await act(adjusted, 'adjustment', {
            amount: -23400,
            reason: 'Full agreed credit pending review',
        })
        await act(adjusted, 'receipt', { meters: 583 })
        await assert.rejects(
            act(adjusted, 'resolve', {
                decision: 'accepted',
                reason: 'Accept fewer metres',
            }),
            /negative charges/,
        )
        assert.equal((await get(adjusted)).difference_status, 'review')
    })
    await test('revoked, locked and downgraded owners cannot mutate challans', async () => {
        await admin.query(
            'update organizations set is_locked_down=true where id=$1',
            [org],
        )
        await assert.rejects(
            act(id, 'payment', financial(1)),
            /locked|restricted/i,
        )
        await admin.query(
            'update organizations set is_locked_down=false where id=$1',
            [org],
        )
        await admin.query(
            "update org_subscriptions set plan_tier='lite' where org_id=$1",
            [org],
        )
        await assert.rejects(call(a, id, 1, 'confirm'), /access required/)
        await admin.query(
            "update org_subscriptions set plan_tier='base' where org_id=$1",
            [org],
        )
        await admin.query(
            "update profiles set access_revoked_at=now() where id='10000000-0000-4000-8000-000000000001'",
        )
        await assert.rejects(call(a, id, 1, 'confirm'), /access required/)
        await admin.query(
            "update profiles set access_revoked_at=null where id='10000000-0000-4000-8000-000000000001'",
        )
    })
    await test('acknowledged overage remains under review until explicitly accepted', async () => {
        await setStock(1000)
        const over = await create()
        await act(over, 'confirm')
        await act(over, 'receipt', { meters: 587 })
        assert.equal((await get(over)).difference_status, 'review')
        assert.equal(await balance(over), 23400)
        await act(over, 'resolve', { decision: 'accepted', reason: 'Accept remeasured quantity' })
        assert.equal(await balance(over), 23480)
        assert.equal(await stock(), 415)
    })
    await test('RLS, role, tenant, direct mutation, stale version and bad payload safeguards', async () => {
        assert.equal(
            (await outsider.query('select * from delivery_challans')).rowCount,
            0,
        )
        assert.equal(
            (await floor.query('select * from delivery_challan_events'))
                .rowCount,
            0,
        )
        await assert.rejects(call(floor, id, 1, 'confirm'), /access required/)
        await assert.rejects(call(outsider, id, 1, 'confirm'), /not found/)
        await assert.rejects(
            a.query('update delivery_challans set selling_rate=1'),
            /permission denied/,
        )
        await assert.rejects(
            a.query('delete from delivery_challan_events'),
            /permission denied/,
        )
        await assert.rejects(call(a, id, 0, 'payment', financial(1)), /changed/)
        await assert.rejects(
            create({ ...body, lines: [{ lot: 'x', meters: -1 }] }),
            /Invalid lot/,
        )
        await assert.rejects(
            create({
                ...body,
                lines: [
                    { lot: 'x', meters: 1 },
                    { lot: 'x', meters: 2 },
                ],
            }),
            /unique/,
        )
        await assert.rejects(
            create({ ...body, selling_rate: 'NaN' }),
            /agreed selling rate/,
        )
        assert.equal(
            (
                await admin.query(
                    "select has_function_privilege('anon','public.mutate_delivery_challan(uuid,uuid,integer,text,jsonb)','execute') allowed",
                )
            ).rows[0].allowed,
            false,
        )
    })
}
