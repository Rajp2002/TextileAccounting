import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { en } from '../lib/i18n/locales/en'
import { hi } from '../lib/i18n/locales/hi'
import { gu } from '../lib/i18n/locales/gu'
import {
    LegacyActionSchema, countGap, legacyPayload, legacyStatus, lineSource, repeatedTakas, sourceTotals, stockTotals,
    type LegacyStock,
} from '@/lib/legacy-stock'
import { ChallanDraftSchema } from '@/lib/delivery-challans'
import { isSameChallanDraft } from '@/lib/challan-draft-entry'
import { fabricActivityBucket } from '@/lib/quality-stock'

const locales = { en, hi, gu }
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({
    language: 'en',
    t: (key: string, values: Record<string, string | number> = {}) => {
        const text = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locales.en) as string ?? key
        return text.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`))
    },
}) }))

import { LegacyStatusLine } from '../app/(dashboard)/owner/stock/LegacyStatusLine'

const row = (patch: Partial<LegacyStock> = {}): LegacyStock => ({
    id: 'l1', quality_id: 'q1', basis: 'unknown', balance_meters: null, basis_meters: null, basis_at: null,
    dispatched_meters: 0, onboarded_meters: 0, status: 'open', started_at: '2026-11-01T04:30:00Z', closed_at: null, version: 1,
    ...patch,
})

describe('legacy stock status', () => {
    it('never reads an unknown balance as zero', () => {
        expect(legacyStatus(row())).toBe('unknown')
        expect(legacyStatus(row({ basis: 'estimated', balance_meters: 0 }))).toBe('estimateAtZero')
    })
    it('flags a balance below zero instead of hiding it', () => {
        expect(legacyStatus(row({ basis: 'estimated', balance_meters: -1200 }))).toBe('estimateExceeded')
        expect(legacyStatus(row({ basis: 'counted', balance_meters: -5 }))).toBe('countExceeded')
    })
    it('offers closing only after a count shows nothing left', () => {
        expect(legacyStatus(row({ basis: 'counted', balance_meters: 0 }))).toBe('readyToClose')
        expect(legacyStatus(row({ basis: 'counted', balance_meters: 0, status: 'closed' }))).toBe('closed')
        expect(legacyStatus(row({ basis: 'counted', balance_meters: 18450 }))).toBe('counted')
    })
})

describe('stock totals', () => {
    it('calls the total incomplete while any legacy balance is unknown', () => {
        const totals = stockTotals([7800], [row({ dispatched_meters: 4200 })])
        expect(totals).toMatchObject({ orange: 7800, total: 7800, unknownQualities: 1, exact: false })
    })
    it('adds an estimate but never calls it exact', () => {
        expect(stockTotals([7800], [row({ basis: 'estimated', balance_meters: 25800 })])).toMatchObject({ total: 33600, legacyEstimated: 25800, exact: false })
    })
    it('is exact once every open legacy balance is counted or closed', () => {
        const totals = stockTotals([100.1, 200.2], [row({ basis: 'counted', balance_meters: 0.3 }), row({ basis: 'counted', balance_meters: 0, status: 'closed' })])
        expect(totals).toMatchObject({ total: 300.6, exact: true })
    })
    it('adds nothing for a balance below zero', () => {
        expect(stockTotals([500], [row({ basis: 'counted', balance_meters: -60 })]).total).toBe(500)
    })
})

describe('legacy stock actions', () => {
    it('rejects metres for an unknown amount and requires them otherwise', () => {
        expect(LegacyActionSchema.safeParse({ action: 'start', basis: 'unknown' }).success).toBe(true)
        expect(LegacyActionSchema.safeParse({ action: 'start', basis: 'unknown', meters: 10 }).success).toBe(false)
        expect(LegacyActionSchema.safeParse({ action: 'start', basis: 'estimated' }).success).toBe(false)
        expect(LegacyActionSchema.safeParse({ action: 'start', basis: 'estimated', meters: 10.555 }).success).toBe(false)
        expect(LegacyActionSchema.safeParse({ action: 'count', meters: -1 }).success).toBe(false)
    })
    it('needs explicit confirmation to close and a reason to reopen', () => {
        expect(LegacyActionSchema.safeParse({ action: 'close', confirmed: false }).success).toBe(false)
        expect(LegacyActionSchema.safeParse({ action: 'close', confirmed: true }).success).toBe(true)
        expect(LegacyActionSchema.safeParse({ action: 'reopen', basis: 'unknown', reason: '' }).success).toBe(false)
        expect(LegacyActionSchema.safeParse({ action: 'reopen', basis: 'unknown', reason: 'Found more bales' }).success).toBe(true)
    })
    it('refuses repeated taka numbers and empty rows when onboarding', () => {
        expect(LegacyActionSchema.safeParse({ action: 'onboard', lines: [{ lot: '104', meters: 98 }, { lot: ' 104', meters: 99 }] }).success).toBe(false)
        expect(LegacyActionSchema.safeParse({ action: 'onboard', lines: [{ lot: '104', meters: 0 }] }).success).toBe(false)
        expect(LegacyActionSchema.safeParse({ action: 'onboard', lines: [] }).success).toBe(false)
    })
    it('sends only the fields the database reads', () => {
        const parsed = LegacyActionSchema.parse({ action: 'start', basis: 'unknown', reason: '  ' })
        expect(legacyPayload(parsed)).toEqual({ basis: 'unknown' })
        expect(legacyPayload(LegacyActionSchema.parse({ action: 'count', meters: 9000, reason: 'Rack A' }))).toEqual({ meters: 9000, reason: 'Rack A' })
    })
    it('reports the gap a count reveals, or none when nothing was expected', () => {
        expect(countGap(25800, 18450)).toBe(-7350)
        expect(countGap(null, 18450)).toBeNull()
    })
    it('finds taka numbers already onboarded for a quality', () => {
        const movements = [
            { kind: 'onboard' as const, lines: [{ lot: '104', meters: 98 }], created_at: '2026-11-12T05:00:00Z' },
            { kind: 'dispatch' as const, lines: null, created_at: '2026-11-13T05:00:00Z' },
        ]
        expect(repeatedTakas(['104', '105'], movements)).toEqual([{ lot: '104', at: '2026-11-12T05:00:00Z' }])
    })
})

describe('Orange and Legacy challan lines', () => {
    const draft = (source?: 'tracked' | 'legacy') => ({
        quality_id: '00000000-0000-4000-8000-000000000001', selling_rate: 40,
        document: { sender_name: 'S', sender_address: 'A', customer_name: 'C', customer_address: 'A', delivery_address: 'A', date: '2026-10-15' },
        lines: [{ lot: '89895', meters: 100, ...(source ? { source } : {}) }],
    })
    it('treats a line without a source as Orange', () => {
        expect(lineSource({})).toBe('tracked')
        expect(sourceTotals([{ meters: 0.1 }, { meters: 0.2, source: 'legacy' }, { meters: 0.2, source: 'legacy' }])).toEqual({ tracked: 0.1, legacy: 0.4 })
    })
    it('accepts Orange and Legacy lines and nothing else', () => {
        expect(ChallanDraftSchema.safeParse(draft('legacy')).success).toBe(true)
        expect(ChallanDraftSchema.safeParse(draft()).success).toBe(true)
        expect(ChallanDraftSchema.safeParse({ ...draft(), lines: [{ lot: '1', meters: 1, source: 'other' }] }).success).toBe(false)
    })
    it('counts switching a line to Legacy as a change worth saving', () => {
        expect(isSameChallanDraft(draft(), draft('tracked'))).toBe(true)
        expect(isSameChallanDraft(draft(), draft('legacy'))).toBe(false)
    })
    it('counts onboarding as its own week total', () => {
        expect(fabricActivityBucket('legacy_onboarding')).toBe('onboarded')
    })
})

describe('legacy status line', () => {
    it('says "not counted" for an unknown balance and never shows 0 m', () => {
        const html = renderToStaticMarkup(<LegacyStatusLine legacy={row({ dispatched_meters: 4200 })} />)
        expect(html).toContain('Legacy: not counted')
        expect(html).toContain('4,200 m sent since')
        expect(html).not.toMatch(/\b0 m\b/)
    })
    it('labels an estimate as an estimate', () => {
        expect(renderToStaticMarkup(<LegacyStatusLine legacy={row({ basis: 'estimated', balance_meters: 25800, basis_meters: 30000, basis_at: '2026-11-01T04:30:00Z' })} />))
            .toContain('about 25,800 m (estimate)')
    })
    it('shows an exceeded estimate as metres to count', () => {
        const html = renderToStaticMarkup(<LegacyStatusLine legacy={row({ basis: 'estimated', balance_meters: -1200, basis_meters: 100, basis_at: '2026-11-01T04:30:00Z' })} />)
        expect(html).toContain('1,200 m more sent than estimated. Count needed')
        expect(html).toContain('data-legacy-status="estimateExceeded"')
    })
})

describe('legacy stock wiring', () => {
    const migration = readFileSync('supabase/migrations/20261015120000_legacy_fabric_stock.sql', 'utf8')
    const stock = readFileSync('app/(dashboard)/owner/stock/QualityStockClient.tsx', 'utf8')
    const editor = readFileSync('app/(dashboard)/owner/dispatches/ChallanDraftEditor.tsx', 'utf8')

    it('writes only through owner-checked definer functions with a fixed search path', () => {
        for (const fn of ['private.move_legacy_stock', 'public.mutate_legacy_stock']) {
            const body = migration.slice(migration.indexOf(`CREATE FUNCTION ${fn}(`))
            expect(body.slice(0, 600)).toContain("SECURITY DEFINER SET search_path = ''")
        }
        expect(migration).toContain('REVOKE ALL ON public.legacy_stock, public.legacy_stock_movements FROM PUBLIC, anon, authenticated, service_role')
        expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.mutate_legacy_stock(uuid, uuid, integer, text, jsonb) TO authenticated')
        expect(migration).not.toMatch(/GRANT EXECUTE ON FUNCTION private\.move_legacy_stock/)
        expect(migration).toContain("PERFORM public.assert_org_not_locked(o)")
        expect(migration.match(/pg_advisory_xact_lock\(hashtextextended\(o::text \|\| ':quality-stock'/g)).toHaveLength(2)
    })
    it('keeps an unknown balance empty and never clamps a legacy balance', () => {
        expect(migration).toContain("CHECK ((basis = 'unknown') = (balance_meters IS NULL))")
        expect(migration).not.toMatch(/greatest\(|GREATEST\(/)
    })
    it('debits and restores a challan’s legacy metres at most once', () => {
        expect(migration).toContain('CREATE UNIQUE INDEX legacy_stock_movements_once_per_source')
        expect(migration).toContain('reverses_id uuid UNIQUE')
    })
    it('shows legacy stock on each quality and a total that admits what is unknown', () => {
        expect(stock).toContain('<LegacyStatusLine legacy={legacyOf.get(quality.id)!} />')
        expect(stock).toContain("tx('totalIncompleteOne')")
        expect(stock).toContain('<LegacyStockDialog')
        expect(editor).toContain('data-source-row={index}')
        expect(editor).toContain("t('challan.splitSummary'")
    })
    it('has every legacy label in all three languages', () => {
        const keys = Object.keys(en.qualityStock).filter(key => /^(legacy|lkind_|basis|total|onboard|taka|count|orangeOnHand|repeatedTakas|saveAnyway|addTaka|removeTaka|reopenReason|expectedNow)/.test(key))
        expect(keys.length).toBeGreaterThan(50)
        for (const locale of [hi, gu]) for (const key of keys) expect((locale.qualityStock as Record<string, string>)[key], key).toBeTruthy()
        for (const locale of [en, hi, gu]) for (const key of ['sourceOrange', 'sourceLegacy', 'stockSource', 'sourceToggle', 'sourceHelp', 'splitSummary', 'orangeShort', 'legacyClosed'])
            expect((locale.challan as Record<string, string>)[key], key).toBeTruthy()
    })
})
