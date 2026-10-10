import { describe, expect, it, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'
import type { InventoryAuditBoard } from '../lib/inventory-audit'

// PI-06 (client half) and PI-07 for the Stock audit page.
const dictionaries = { en, gu, hi } as const
const state = vi.hoisted(() => ({ language: 'en' as 'en' | 'gu' | 'hi' }))

const lookup = (source: unknown, key: string): string | undefined => {
    const value = key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), source)
    return typeof value === 'string' ? value : undefined
}
const interpolate = (text: string, values?: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, name) => String(values?.[name] ?? `{${name}}`))

vi.mock('@/lib/i18n/context', () => ({
    useTranslation: () => ({
        language: state.language,
        t: (key: string, values?: Record<string, string | number>) => interpolate(lookup(dictionaries[state.language], key) ?? lookup(en, key) ?? key, values),
        tx: (text: string) => text,
    }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: unknown; href: string }) => createElement('a', { href }, children as never) }))
vi.mock('sonner', () => ({ toast: { success: () => undefined, error: () => undefined } }))
vi.mock('@/app/(dashboard)/owner/stock/audit/actions', () => ({
    applyAuditAdjustmentAction: async () => ({ success: true, variance: 0 }),
    createInventoryAuditAction: async () => ({ success: true, auditId: 'a' }),
    finalizeInventoryAuditAction: async () => ({ success: true, auditId: 'a' }),
    getInventoryAuditDataAction: async () => ({ error: 'unused' }),
    saveAuditPhysicalCountAction: async () => ({ success: true }),
}))
import InventoryAuditClient from '../app/(dashboard)/owner/stock/audit/InventoryAuditClient'

const clientSource = readFileSync('app/(dashboard)/owner/stock/audit/InventoryAuditClient.tsx', 'utf8')
const between = (from: string, to: string) => clientSource.slice(clientSource.indexOf(from), clientSource.indexOf(to))

const board = (overrides: Partial<InventoryAuditBoard> = {}): InventoryAuditBoard => ({
    audit_date: '2026-09-30',
    audit: { id: 'audit-1', org_id: 'org', audit_date: '2026-09-30', status: 'draft', title: 'Stock Audit', notes: null, snapshot: null, created_by: null, finalized_by: null, finalized_at: null, created_at: '', updated_at: '' },
    lines: [
        { id: 'l1', audit_id: 'audit-1', org_id: 'org', item_type: 'fabric', item_id: 'q1', item_label: 'Cotton Poplin', system_quantity: 120, physical_count: 118, variance: -2, adjustment_applied: false, adjustment_movement_id: null, notes: null, created_at: '', updated_at: '' },
        { id: 'l2', audit_id: 'audit-1', org_id: 'org', item_type: 'yarn', item_id: 'y1', item_label: '40s Cotton', system_quantity: 74, physical_count: 74, variance: 0, adjustment_applied: false, adjustment_movement_id: null, notes: null, created_at: '', updated_at: '' },
    ],
    summary: { total_fabric_meters: 130, total_loose_yarn_kg: 74, total_embodied_yarn_kg: 12.5, total_yarn_represented_kg: 86.5, unresolved_fabric_meters: 20 },
    yarns: [{ id: 'y1', yarn_name: '40s Cotton', yarn_key: '40s cotton', system_loose_kg: 74 }],
    fabric: [{ id: 'q1', quality_label: 'Cotton Poplin', quality_key: 'cotton poplin', system_meters: 130 }],
    material_position: [{
        yarn_id: 'y1', yarn_name: '40s Cotton', yarn_key: '40s cotton', loose_kg: 74, embodied_kg: 12.5, total_represented_kg: 86.5,
        drilldown: [{ lot_id: 'lot', quality_label: 'Cotton Poplin', costing_version: 2, produced_meters: 130, remaining_meters: 130, embodied_kg: 12.5, production_date: '2026-09-29', created_at: '' }],
    }],
    ...overrides,
})
const render = (tab: 'material-position' | 'fabric' | 'yarn' | 'reconciliation', data = board()) => renderToStaticMarkup(createElement(InventoryAuditClient, { initialData: data, initialTab: tab }))

beforeEach(() => { state.language = 'en' })

describe('audit views use the liquid tab toggle', () => {
    it('links the selected tab to its panel', () => {
        const html = render('yarn')
        expect(html).toContain('role="tablist"')
        expect(html).toMatch(/id="stock-audit-tab-yarn"[^>]*aria-selected="true"/)
        expect(html).toContain('aria-controls="stock-audit-panel-yarn"')
        expect(html).toMatch(/id="stock-audit-panel-yarn"[^>]*aria-labelledby="stock-audit-tab-yarn"|aria-labelledby="stock-audit-tab-yarn"[^>]*id="stock-audit-panel-yarn"/)
    })
})

describe('PI-06: changing the audit date loads that date only', () => {
    const handler = between('async function handleDateChange', 'function handleExportCsv')

    it('asks for the new date without the previous audit id, so audit A cannot be shown under date B', () => {
        expect(handler).toContain('getInventoryAuditDataAction({ auditDate: newDate })')
        expect(handler).not.toContain('auditId')
    })

    it('ignores an answer that arrives after a newer date was chosen', () => {
        expect(clientSource).toContain('const dateRequest = useRef(0)')
        expect(handler).toContain('const request = ++dateRequest.current')
        expect(handler).toContain('if (request !== dateRequest.current) return')
    })

    it('puts the picker back on the date actually shown when the load fails', () => {
        expect(handler).toContain('setAuditDate(data.audit_date)')
        expect(handler).toContain('setAuditDate(res.data.audit_date)')
    })

    it('records, refreshes and adjusts against the board that is on screen, never the picker value alone', () => {
        const actionsSource = between('async function handleSavePhysicalCount', 'return (')
        expect(actionsSource).toContain('createInventoryAuditAction({ auditDate: data.audit_date')
        expect(actionsSource).not.toMatch(/getInventoryAuditDataAction\(\{ auditDate,/)
        expect(actionsSource).toContain('auditDate: data.audit_date')
    })

    it('lets the owner return to an earlier date after finalizing, capped at the loaded date', () => {
        expect(clientSource).toContain('disabled={isPending}')
        expect(clientSource).not.toContain('disabled={isPending || isFinalized}')
        expect(clientSource).toContain('max={initialData.audit_date}')
        expect(handler).toContain('if (!newDate) return')
    })
})

describe('PI-06: the adjustment shown is the adjustment applied', () => {
    it('sends the variance that was shown, and the dialog derives it from the figures beside it', () => {
        const apply = between('async function handleApplyAdjustment', 'async function handleFinalizeAudit')
        expect(apply).toContain('const dialog = adjustDialog')
        expect(apply).toContain('expectedVariance: dialog.variance')
        expect(clientSource).toContain('auditVariance(physical, item.system_meters, 2)')
        expect(clientSource).toContain('auditVariance(physical, item.system_loose_kg, 3)')
    })

    it('shows a draft the current variance and a finalized audit its frozen record', () => {
        expect(clientSource).toContain('isFinalized ? line?.variance ?? null : auditVariance(')
    })

    it('shows the row variance, not a stale stored one, when stock moved after the count was recorded', () => {
        // Count recorded against 120 m (variance -2 stored); the board now says 130 m, so 118 counted is -12.
        state.language = 'en'
        const html = render('fabric')
        expect(html).toContain('-12.00 m')
        expect(html).not.toContain('-2.00 m')
    })
})

describe('PI-07: the Stock audit page is available in English, Gujarati and Hindi', () => {
    const keys = Object.keys(en.stockAudit ?? {})
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort().join(',')

    it('defines the same keys in all three languages', () => {
        expect(keys.length).toBeGreaterThan(80)
        expect(Object.keys((gu as { stockAudit?: object }).stockAudit ?? {})).toEqual(keys)
        expect(Object.keys((hi as { stockAudit?: object }).stockAudit ?? {})).toEqual(keys)
    })

    it('keeps every placeholder in every translation', () => {
        for (const key of keys) for (const language of ['gu', 'hi'] as const) {
            const text = lookup(dictionaries[language], `stockAudit.${key}`) ?? ''
            expect(placeholders(text), `${language} ${key}`).toBe(placeholders(lookup(en, `stockAudit.${key}`)!))
        }
    })

    it('translates rather than copies: Gujarati and Hindi use their own script for every sentence or label', () => {
        const allowedSame = new Set(['exportCsv'])
        for (const key of keys) {
            const english = lookup(en, `stockAudit.${key}`)!
            if (!/[A-Za-z]{3}/.test(english.replace(/\{\w+\}/g, '')) || allowedSame.has(key)) continue
            expect(lookup(gu, `stockAudit.${key}`), `gu ${key}`).toMatch(/[઀-૿]/)
            expect(lookup(hi, `stockAudit.${key}`), `hi ${key}`).toMatch(/[ऀ-ॿ]/)
        }
    })

    it('uses only keys that exist, and every key is read by the page or its loading skeleton', () => {
        const loadingSource = readFileSync('components/navigation/owner-route-loading.tsx', 'utf8')
        for (const key of keys) expect(clientSource + loadingSource, key).toContain(`t('stockAudit.${key}'`)
        const used = [...(clientSource + loadingSource).matchAll(/t\('stockAudit\.(\w+)'/g)].map(match => match[1])
        for (const key of used) expect(keys, `unknown key ${key}`).toContain(key)
    })

    it('leaves no English literal in the JSX, toasts or attributes', () => {
        const source = clientSource
        const literals: string[] = []
        for (const match of source.matchAll(/toast\.(?:success|error)\(\s*(['"`])((?:(?!\1).)+)\1/g)) literals.push(`toast: ${match[2]}`)
        for (const match of source.matchAll(/\b(?:aria-label|placeholder|title)="([^"{]*[A-Za-z]{3}[^"]*)"/g)) literals.push(`attribute: ${match[1]}`)
        for (const match of source.matchAll(/>\s*([A-Z][A-Za-z&/,.'() -]{2,}?)\s*</g)) literals.push(`text: ${match[1]}`)
        expect(literals).toEqual([])
    })

    it('renders every tab in Gujarati and Hindi with no English label left over', () => {
        const leftovers = ['Material Position', 'Fabric Physical Audit', 'Loose Yarn Physical Audit', 'Record Count', 'Physical Count', 'System Stock', 'Variance', 'Reconciliation Status', 'Finalize Audit', 'Audit Date', 'Export CSV', 'Back to stock', 'Draft', 'Fabric on Hand', 'Total Represented', 'Notice regarding legacy', 'Yarn Specification', 'Breakdown']
        for (const language of ['gu', 'hi'] as const) {
            state.language = language
            for (const tab of ['material-position', 'fabric', 'yarn', 'reconciliation'] as const) {
                const html = render(tab).replace(/<[^>]+>/g, ' ')
                for (const text of leftovers) expect(html, `${language} ${tab} still shows "${text}"`).not.toContain(text)
                expect(html).toMatch(language === 'gu' ? /[઀-૿]/ : /[ऀ-ॿ]/)
            }
        }
    })

    it('renders English unchanged', () => {
        const html = render('fabric').replace(/<[^>]+>/g, ' ')
        for (const text of ['Fabric Physical Audit', 'System Stock', 'Physical Count', 'Variance', 'Edit Count', 'Adjust']) expect(html).toContain(text)
    })

    it('tells apart "nothing counted yet" from "counted, no differences" on the Reconciliation tab (SA-5)', () => {
        const none = render('reconciliation', board({ lines: [] })).replace(/<[^>]+>/g, ' ')
        expect(none).toContain(en.stockAudit.recNoCounts)
        expect(none).not.toContain(en.stockAudit.recNoVariance)
        const matching = render('reconciliation', board({ lines: [board().lines[1]] })).replace(/<[^>]+>/g, ' ')
        expect(matching).toContain(en.stockAudit.recNoVariance)
        expect(matching).not.toContain(en.stockAudit.recNoCounts)
    })

    it('translates the route loading title too', () => {
        const loading = readFileSync('components/navigation/owner-route-loading.tsx', 'utf8')
        expect(loading).toContain("t('stockAudit.title')")
        expect(loading).toContain("t('stockAudit.loadingLabel'")
    })
})

