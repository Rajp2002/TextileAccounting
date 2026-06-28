#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const workspace = process.cwd()
const PAGE_SIZE = 100
const MOVEMENT_COUNT = 506

function parseEnv(contents) {
    const result = {}
    for (const rawLine of contents.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
        if (!match) continue
        let value = match[2].trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
        }
        result[match[1]] = value
    }
    return result
}

async function readEnv() {
    const env = { ...process.env }
    for (const relative of ['.env.local', 'supabase/.env.local']) {
        try {
            Object.assign(env, parseEnv(await fs.readFile(path.join(workspace, relative), 'utf8')))
        } catch (error) {
            if (error.code !== 'ENOENT') throw error
        }
    }
    return env
}

function todayDate() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date())

    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    return `${byType.year}-${byType.month}-${byType.day}`
}

function safeId(value) {
    return typeof value === 'string' ? `${value.slice(0, 8)}...${value.slice(-4)}` : null
}

function assertCondition(assertions, name, passed, details = {}) {
    assertions.push({ name, passed, ...details })
    if (!passed) {
        throw new Error(`${name} failed: ${JSON.stringify(details)}`)
    }
}

function cursorFilter(cursor) {
    return [
        `created_at.lt.${cursor.created_at}`,
        `and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
    ].join(',')
}

function nextCursor(rows, hasMore) {
    if (!hasMore || rows.length === 0) return null
    const last = rows[rows.length - 1]
    return { created_at: last.created_at, id: last.id }
}

function isNewestToOldest(rows) {
    for (let index = 1; index < rows.length; index += 1) {
        const prev = rows[index - 1]
        const current = rows[index]
        if (prev.created_at < current.created_at) return false
        if (prev.created_at === current.created_at && prev.id < current.id) return false
    }
    return true
}

async function createDisposableOwner(admin, anon) {
    const suffix = crypto.randomBytes(5).toString('hex')
    const email = `batch5-stock-${suffix}@qa.weavly.local`
    const password = `B5-${suffix}-${crypto.randomBytes(8).toString('hex')}!`

    const { data: userData, error: userError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: 'Batch 5 Stock Owner' },
    })
    if (userError || !userData.user) throw new Error(`failed to create disposable user: ${userError?.message}`)

    const { data: org, error: orgError } = await admin
        .from('organizations')
        .insert({
            name: `Batch 5 Stock ${suffix}`,
            owner_id: userData.user.id,
            join_code: `B5${suffix.slice(0, 6).toUpperCase()}`,
            join_code_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            onboarding_complete: true,
            production_mode: 'market_run',
        })
        .select('id')
        .single()
    if (orgError || !org) throw new Error(`failed to create disposable org: ${orgError?.message}`)

    const { error: profileError } = await admin
        .from('profiles')
        .insert({
            id: userData.user.id,
            org_id: org.id,
            role: 'owner',
            full_name: 'Batch 5 Stock Owner',
            email,
        })
    if (profileError) throw new Error(`failed to create disposable profile: ${profileError.message}`)

    const client = createClient(anon.url, anon.key, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    const signIn = await client.auth.signInWithPassword({ email, password })
    if (signIn.error || !signIn.data.user) throw new Error(`failed to sign in disposable owner: ${signIn.error?.message}`)

    const secondClient = createClient(anon.url, anon.key, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    const secondSignIn = await secondClient.auth.signInWithPassword({ email, password })
    if (secondSignIn.error || !secondSignIn.data.user) {
        throw new Error(`failed to sign in second disposable owner session: ${secondSignIn.error?.message}`)
    }

    return {
        client,
        secondClient,
        email,
        password,
        orgId: org.id,
        userId: userData.user.id,
    }
}

async function cleanupDisposable(admin, resource, options = {}) {
    if (!resource) return []

    const errors = []

    for (const table of [
        'commercial_payment_receipts',
        'commercial_receivables',
        'dispatch_package_lines',
        'fabric_packages',
        'stock_discrepancies',
        'dispatches',
        'fabric_stock_movements',
        'fabric_stock_sales',
        'fabric_stock_lots',
        'parties',
    ]) {
        try {
            const { error } = await admin.from(table).delete().eq('org_id', resource.orgId)
            if (error) errors.push(`${table}: ${error.message}`)
        } catch (error) {
            errors.push(`${table}: ${String(error.message || error)}`)
        }
    }

    try {
        const { error } = await admin.from('profiles').delete().eq('id', resource.userId)
        if (error) errors.push(`profiles: ${error.message}`)
    } catch (error) {
        errors.push(`profiles: ${String(error.message || error)}`)
    }
    try {
        const { error } = await admin.from('organizations').delete().eq('id', resource.orgId)
        if (error) errors.push(`organizations: ${error.message}`)
    } catch (error) {
        errors.push(`organizations: ${String(error.message || error)}`)
    }
    try {
        const { error } = await admin.auth.admin.deleteUser(resource.userId)
        if (error) errors.push(`auth.users: ${error.message}`)
    } catch (error) {
        errors.push(`auth.users: ${String(error.message || error)}`)
    }

    if (options.throwOnError && errors.length > 0) {
        throw new Error(`disposable cleanup failed: ${errors.join('; ')}`)
    }

    return errors
}

async function createStockLot(owner, orgId) {
    const { data, error } = await owner
        .from('fabric_stock_lots')
        .insert({
            org_id: orgId,
            quality_label: 'Batch 5 Audit Fabric',
            godown: 'Batch 5 QA Godown',
            source_type: 'manual',
            original_taka_count: 2,
            available_taka_count: 2,
            meters_per_taka: 50,
            unit_label: 'taka',
            original_meters: 100,
            available_meters: 100,
            stock_purpose: 'manual',
            cost_per_meter: 28,
            received_date: todayDate(),
            notes: 'Batch 5 disposable stock audit proof',
        })
        .select('id')
        .single()

    if (error || !data) throw new Error(`failed to create disposable stock lot: ${error?.message}`)
    return data.id
}

async function seedMovements(owner, orgId, stockLotId) {
    const base = Date.UTC(2026, 5, 28, 12, 0, 0)
    const rows = Array.from({ length: MOVEMENT_COUNT }, (_, index) => ({
        org_id: orgId,
        stock_lot_id: stockLotId,
        movement_type: index % 2 === 0 ? 'adjustment_add' : 'adjustment_subtract',
        movement_date: '2026-06-28',
        taka_delta: index % 2 === 0 ? 0.01 : -0.01,
        meters_delta: index % 2 === 0 ? 0.5 : -0.5,
        reference: `Batch 5 movement ${String(index + 1).padStart(3, '0')}`,
        notes: 'Batch 5 disposable movement pagination proof',
        created_at: new Date(base - Math.floor(index / 3) * 1000).toISOString(),
    }))

    for (let index = 0; index < rows.length; index += 100) {
        const { error } = await owner
            .from('fabric_stock_movements')
            .insert(rows.slice(index, index + 100))
        if (error) throw new Error(`failed to seed movement batch ${index}: ${error.message}`)
    }
}

async function fetchMovementPage(owner, orgId, stockLotId, cursor = null) {
    let query = owner
        .from('fabric_stock_movements')
        .select(`
            id,
            stock_lot_id,
            movement_type,
            movement_date,
            taka_delta,
            meters_delta,
            reference,
            notes,
            created_at,
            fabric_stock_lots!inner (
                quality_label,
                godown,
                unit_label
            )
        `)
        .eq('org_id', orgId)
        .eq('stock_lot_id', stockLotId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE + 1)

    if (cursor) query = query.or(cursorFilter(cursor))

    const { data, error } = await query
    if (error) throw new Error(`movement page query failed: ${error.message}`)

    const rows = data.slice(0, PAGE_SIZE)
    const hasMore = data.length > PAGE_SIZE
    return {
        rows,
        hasMore,
        cursor: nextCursor(rows, hasMore),
    }
}

async function fetchStockSnapshot(owner, orgId, stockLotId) {
    const [lotRes, saleRes, movementRes, receivableRes] = await Promise.all([
        owner
            .from('fabric_stock_lot_summary')
            .select('stock_lot_id, available_meters, available_taka_count, sold_meters, sold_taka_count')
            .eq('org_id', orgId)
            .eq('stock_lot_id', stockLotId)
            .single(),
        owner
            .from('fabric_stock_sales')
            .select('id, meters_sold, pending_dispatch_meters, dispatch_status, revenue_amount')
            .eq('org_id', orgId)
            .eq('stock_lot_id', stockLotId)
            .order('created_at', { ascending: false })
            .limit(1),
        owner
            .from('fabric_stock_movements')
            .select('id, movement_type, meters_delta, sale_id')
            .eq('org_id', orgId)
            .eq('stock_lot_id', stockLotId)
            .eq('movement_type', 'sale')
            .limit(5),
        owner
            .from('commercial_receivables')
            .select('id, total_amount, balance_amount, payment_status, source_type')
            .eq('org_id', orgId)
            .eq('source_type', 'fabric_stock_sale')
            .limit(5),
    ])

    const error = lotRes.error || saleRes.error || movementRes.error || receivableRes.error
    if (error) throw new Error(`stock snapshot query failed: ${error.message}`)

    return {
        lot: lotRes.data,
        latestSale: saleRes.data?.[0] ?? null,
        saleMovementCount: movementRes.data?.length ?? 0,
        receivableCount: receivableRes.data?.length ?? 0,
        latestReceivable: receivableRes.data?.[0] ?? null,
    }
}

async function main() {
    const env = await readEnv()
    const url = env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !anonKey || !serviceKey) {
        throw new Error('Missing Supabase URL, anon key, or service-role key in local env files.')
    }

    const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    const anon = { url, key: anonKey }
    const assertions = []
    let resource = null
    let outputPath = null

    try {
        resource = await createDisposableOwner(admin, anon)
        const stockLotId = await createStockLot(resource.client, resource.orgId)
        await seedMovements(resource.client, resource.orgId, stockLotId)

        let cursor = null
        const collected = []
        const pageLengths = []
        for (let index = 0; index < 10; index += 1) {
            const page = await fetchMovementPage(resource.client, resource.orgId, stockLotId, cursor)
            pageLengths.push(page.rows.length)
            collected.push(...page.rows)
            cursor = page.cursor
            if (!page.hasMore) break
        }

        assertCondition(assertions, 'older-than-500 movements are reachable', collected.length === MOVEMENT_COUNT, {
            collected: collected.length,
            expected: MOVEMENT_COUNT,
            pageLengths,
        })
        assertCondition(assertions, 'movement pagination has no duplicate rows', new Set(collected.map((row) => row.id)).size === MOVEMENT_COUNT)
        assertCondition(assertions, 'movement pagination is newest-to-oldest deterministic', isNewestToOldest(collected))

        const idempotencyKey = `batch5-stock-sale:${crypto.randomUUID()}`
        const saleResult = await resource.client.rpc('create_party_stock_sale_dispatch_v1', {
            p_source_type: 'stock_lot',
            p_source_id: stockLotId,
            p_party_name: 'Batch 5 Buyer',
            p_party_phone: null,
            p_party_city: 'Surat',
            p_party_gstin: null,
            p_sold_meters: 25,
            p_sold_takas: null,
            p_sale_rate_per_meter: 42,
            p_credit_days: 7,
            p_sale_date: todayDate(),
            p_dispatch_now: false,
            p_actual_dispatched_meters: null,
            p_dispatch_date: null,
            p_transport_name: null,
            p_vehicle_number: null,
            p_challan_number: null,
            p_notes: 'Batch 5 sale-only refresh proof',
            p_party_id: null,
            p_idempotency_key: idempotencyKey,
        })
        if (saleResult.error) throw new Error(`sale-only RPC failed: ${saleResult.error.message}`)
        const saleRow = Array.isArray(saleResult.data) ? saleResult.data[0] : saleResult.data

        assertCondition(assertions, 'sale-only mutation returned no dispatch id', !saleRow?.dispatch_id, {
            saleId: safeId(saleRow?.sale_id),
            dispatchId: safeId(saleRow?.dispatch_id),
        })
        assertCondition(assertions, 'sale-only mutation returned pending dispatch meters', Number(saleRow?.pending_dispatch_meters ?? 0) === 25)

        const firstSessionSnapshot = await fetchStockSnapshot(resource.client, resource.orgId, stockLotId)
        const secondSessionSnapshot = await fetchStockSnapshot(resource.secondClient, resource.orgId, stockLotId)

        assertCondition(assertions, 'available meters update after sale-only mutation', Number(firstSessionSnapshot.lot.available_meters) === 75, {
            availableMeters: Number(firstSessionSnapshot.lot.available_meters),
        })
        assertCondition(assertions, 'pending dispatch reconciles after sale-only mutation', Number(firstSessionSnapshot.latestSale?.pending_dispatch_meters ?? 0) === 25)
        assertCondition(assertions, 'stock sale movement is recorded exactly once', firstSessionSnapshot.saleMovementCount === 1)
        assertCondition(assertions, 'sale-only creates one receivable', firstSessionSnapshot.receivableCount === 1)
        assertCondition(assertions, 'second session matches committed stock state', (
            Number(secondSessionSnapshot.lot.available_meters) === Number(firstSessionSnapshot.lot.available_meters) &&
            Number(secondSessionSnapshot.latestSale?.pending_dispatch_meters ?? 0) === Number(firstSessionSnapshot.latestSale?.pending_dispatch_meters ?? 0) &&
            secondSessionSnapshot.receivableCount === firstSessionSnapshot.receivableCount
        ), {
            firstAvailableMeters: Number(firstSessionSnapshot.lot.available_meters),
            secondAvailableMeters: Number(secondSessionSnapshot.lot.available_meters),
        })

        const output = {
            run_id: `BATCH5-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`,
            org_id: safeId(resource.orgId),
            stock_lot_id: safeId(stockLotId),
            movement_count: MOVEMENT_COUNT,
            page_size: PAGE_SIZE,
            page_lengths: pageLengths,
            sale_id: safeId(saleRow?.sale_id),
            first_session_snapshot: {
                available_meters: Number(firstSessionSnapshot.lot.available_meters),
                pending_dispatch_meters: Number(firstSessionSnapshot.latestSale?.pending_dispatch_meters ?? 0),
                sale_movement_count: firstSessionSnapshot.saleMovementCount,
                receivable_count: firstSessionSnapshot.receivableCount,
            },
            second_session_snapshot: {
                available_meters: Number(secondSessionSnapshot.lot.available_meters),
                pending_dispatch_meters: Number(secondSessionSnapshot.latestSale?.pending_dispatch_meters ?? 0),
                receivable_count: secondSessionSnapshot.receivableCount,
            },
            assertions,
            cleanup: 'pending',
        }

        const outputDir = path.join(workspace, 'output', 'qa', 'batch5')
        await fs.mkdir(outputDir, { recursive: true })
        outputPath = path.join(outputDir, `${output.run_id}-stock-audit-refresh.json`)
        await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`)

        const cleanupErrors = await cleanupDisposable(admin, resource, { throwOnError: true })
        resource = null

        output.cleanup = 'complete'
        output.cleanup_errors = cleanupErrors
        await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`)

        console.log(JSON.stringify({
            passed: true,
            outputPath,
            assertions: assertions.map(({ name, passed }) => ({ name, passed })),
        }, null, 2))
    } catch (error) {
        let cleanupErrors = []
        if (resource) cleanupErrors = await cleanupDisposable(admin, resource)
        if (outputPath) {
            try {
                const failed = {
                    passed: false,
                    error: String(error.message || error),
                    assertions,
                    cleanup: 'attempted',
                    cleanup_errors: cleanupErrors,
                }
                await fs.writeFile(outputPath, `${JSON.stringify(failed, null, 2)}\n`)
            } catch {}
        }
        throw error
    }
}

await main()
