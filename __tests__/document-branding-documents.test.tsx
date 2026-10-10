import React from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { buildCostingResult, calcFullTotals } from '@/lib/estimator'
import { buildCostingPrintHtml, createCostingExportModel } from '@/lib/estimator-export'
import { buildFabricSpec } from '@/lib/fabric-spec'
import { needsRasterPdf, paginate } from '@/lib/document-pdf'
import { DOCUMENT_LABELS } from '@/lib/i18n/document-labels'
import { BRANDING_COPY_FOR_TESTS, brandingErrorText, brandingText } from '@/lib/i18n/document-branding'
import { LOGO_ERROR_CODES } from '@/lib/document-branding/assets'
import { hasCapability } from '@/lib/subscription-access'
import type { DocumentBranding } from '@/lib/document-branding/types'
import { f1State } from './fixtures/costing-characterization'
import ChallanPrint from '../app/(dashboard)/owner/dispatches/ChallanPrint'
import type { Challan } from '../lib/delivery-challans'
import { en as localeEn } from '../lib/i18n/locales/en'

vi.mock('@/lib/i18n/context', () => ({
    useTranslation: () => ({
        language: 'en',
        t: (key: string) => String(key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], localeEn) ?? key),
    }),
}))

const read = (path: string) => readFileSync(path, 'utf8')
const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const branding: DocumentBranding = {
    logo: { src: LOGO, width: 400, height: 200 },
    profile: { address: 'Plot 12, Pandesara GIDC, Surat', gstin: '24ABCDE1234F1Z5', phone: '+91 98250 00000', email: 'sales@shree.example', bankDetails: 'HDFC Bank · A/c 0000 · IFSC HDFC0000001' },
    defaultQuotationTerms: '',
}

const estimate = f1State()
const totals = calcFullTotals(estimate)
const model = createCostingExportModel({ state: estimate, totals, result: buildCostingResult(estimate, totals), qualityLabel: 'F1 Shirting', createdAt: '2026-10-04T00:00:00Z' })
const customer = { mode: 'customer' as const, businessName: 'Shree Weaves', customerName: 'Ambika Textiles', validUntil: '2026-11-01', notes: '', showGstNote: false, documentReference: 'F1 · v1' }

describe('customer quotation with the factory branding', () => {
    const html = buildCostingPrintHtml(model, { ...customer, branding })

    it('leads with the factory logo and business details instead of the Weavly logo', () => {
        expect(html).toContain('class="factorylogo"')
        expect(html).toContain(LOGO)
        expect(html).toContain('Shree Weaves')
        expect(html).toContain('Plot 12, Pandesara GIDC, Surat')
        expect(html).toContain('GSTIN: 24ABCDE1234F1Z5')
        expect(html).toContain('sales@shree.example')
        expect(html).toContain('HDFC Bank')
    })

    it('keeps a small Powered by Weavly footer', () => {
        expect(html).toContain('class="poweredby"')
        expect(html).toContain('Powered by')
    })

    it('never embeds a logo that is not a PNG data URI', () => {
        for (const src of ['https://evil.example/logo.png', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', `${LOGO}" onerror="x`]) {
            const out = buildCostingPrintHtml(model, { ...customer, branding: { ...branding, logo: { src, width: 10, height: 10 } } })
            expect(out).not.toContain(src)
            expect(out).not.toContain('class="factorylogo"')
        }
    })

    it('escapes business details', () => {
        const out = buildCostingPrintHtml(model, { ...customer, branding: { ...branding, profile: { ...branding.profile, address: '<script>alert(1)</script>' } } })
        expect(out).not.toContain('<script>alert(1)</script>')
        expect(out).toContain('&lt;script&gt;')
    })

    it('keeps the Weavly masthead and no Powered by line without branding', () => {
        const plain = buildCostingPrintHtml(model, customer)
        expect(plain).not.toContain('class="factorylogo"')
        expect(plain).not.toContain('class="poweredby"')
        expect(plain).not.toContain('GSTIN:')
    })
})

describe('fabric specification', () => {
    it('reads width, ends, picks and yarn counts from the costing inputs', () => {
        const spec = buildFabricSpec(estimate)
        expect(spec).not.toBeNull()
        expect(spec!.totalEnds).toBe(estimate.warpRows.reduce((sum, row) => sum + Number(row.beamEnds || 0), 0))
        expect(spec!.picksPerInch).toBe(estimate.weftRows.reduce((sum, row) => sum + Number(row.picks || 0), 0))
        expect(spec!.widthInches).toBeGreaterThan(0)
    })

    it('returns nothing for an empty costing', () => {
        expect(buildFabricSpec({ warpRows: [], weftRows: [] })).toBeNull()
        expect(buildFabricSpec(null)).toBeNull()
    })

    it('shows on the customer quotation by default and can be turned off', () => {
        expect(buildCostingPrintHtml(model, customer)).toContain('Fabric specification')
        expect(buildCostingPrintHtml(model, { ...customer, showFabricSpec: false })).not.toContain('Fabric specification')
    })

    it('never prints yarn row names, which can name the supplier', () => {
        const html = buildCostingPrintHtml(model, { ...customer, branding })
        for (const row of [...estimate.warpRows, ...estimate.weftRows]) if (row.label) expect(html).not.toContain(row.label)
    })
})

describe('document language', () => {
    it('prints Hindi and Gujarati labels and marks the page language', () => {
        const gu = buildCostingPrintHtml(model, { ...customer, branding, language: 'gu' })
        expect(gu).toContain('<html lang="gu">')
        expect(gu).toContain(DOCUMENT_LABELS.gu.fabricSpecification)
        expect(gu).toContain(DOCUMENT_LABELS.gu.customerQuotation)
        const hi = buildCostingPrintHtml(model, { ...customer, language: 'hi', mode: 'internal' })
        expect(hi).toContain('<html lang="hi">')
        expect(hi).toContain(DOCUMENT_LABELS.hi.internalCostSheet)
    })

    it('has every label in all three languages, in the right script, with the same placeholders', () => {
        const keys = Object.keys(DOCUMENT_LABELS.en).sort()
        for (const [language, script] of [['hi', /\p{Script=Devanagari}/u], ['gu', /\p{Script=Gujarati}/u]] as const) {
            const labels = DOCUMENT_LABELS[language]
            expect(Object.keys(labels).sort()).toEqual(keys)
            for (const key of keys) {
                const english = DOCUMENT_LABELS.en[key as keyof typeof labels]
                const translated = labels[key as keyof typeof labels]
                expect(translated.trim(), `${language}.${key}`).not.toBe('')
                if (/[a-z]{3}/.test(english) && translated !== english) expect(translated, `${language}.${key}`).toMatch(script)
                expect((translated.match(/\{\w+\}/g) ?? []).sort(), `${language}.${key}`).toEqual((english.match(/\{\w+\}/g) ?? []).sort())
            }
        }
    })

    it('has the Settings and export copy in all three languages', () => {
        const keys = Object.keys(BRANDING_COPY_FOR_TESTS.en).sort()
        for (const language of ['hi', 'gu'] as const) {
            expect(Object.keys(BRANDING_COPY_FOR_TESTS[language]).sort()).toEqual(keys)
            for (const key of keys) expect(brandingText(language, key as never).trim(), `${language}.${key}`).not.toBe('')
        }
    })

    it('has a message for every logo error and a generic one for anything else', () => {
        for (const language of ['en', 'hi', 'gu'] as const) {
            for (const code of [...LOGO_ERROR_CODES, 'upgrade_required', 'locked']) expect(brandingErrorText(language, code)).not.toBe(brandingErrorText(language, 'something_unexpected'))
            expect(brandingErrorText(language, 'something_unexpected')).toBeTruthy()
        }
    })
})

describe('PDF rendering', () => {
    it('uses vector text only for Latin documents', () => {
        expect(needsRasterPdf('Customer Quotation — Rs 1,200.00 “Poplin”')).toBe(false)
        expect(needsRasterPdf('ગ્રાહક ક્વોટેશન')).toBe(true)
        expect(needsRasterPdf('ग्राहक कोटेशन')).toBe(true)
    })

    it('breaks pages at block bottoms and covers the whole document', () => {
        const pages = paginate(2500, 1000, [400, 950, 1300, 1900, 2400])
        expect(pages).toEqual([{ start: 0, end: 950 }, { start: 950, end: 1900 }, { start: 1900, end: 2500 }])
        expect(paginate(2500, 1000, [])).toEqual([{ start: 0, end: 1000 }, { start: 1000, end: 2000 }, { start: 2000, end: 2500 }])
    })

    it('lets the export dialog use the shared renderer and the branding resolver', () => {
        const dialog = read('components/estimator/CostingExportDialog.tsx')
        expect(dialog).toContain('renderDocumentPdf(extractStyledCostingBody(previewHtml))')
        expect(dialog).toContain('getCostingDocumentBranding()')
        expect(dialog).toContain('/owner/settings#company-profile')
    })
})

describe('delivery challan branding', () => {
    const challan = {
        id: '20000000-0000-4000-8000-000000000001',
        number: 'DC-2026-0042',
        quality_id: '10000000-0000-4000-8000-000000000001',
        quality_label: '60x60 Poplin',
        selling_rate: 40,
        document: { date: '2026-10-09', sender_name: 'Shree Weaves Pvt Ltd', sender_address: 'Surat', sender_gstin: '24ABCDE1234F1Z5', customer_name: 'Ambika Textiles', customer_address: 'Surat', delivery_address: 'Surat', notes: '' },
        lines: [{ lot: '0101', meters: 225 }],
        sent_meters: 225,
        chargeable_meters: 225,
        acknowledged_meters: null,
    } as unknown as Challan

    it('shows the factory logo and Powered by Weavly when branded', () => {
        const html = renderToStaticMarkup(<ChallanPrint d={challan} branding={branding} />)
        expect(html).toContain('masthead branded')
        expect(html).toContain(LOGO)
        expect(html).toContain('Powered by')
    })

    it('keeps the Weavly masthead otherwise', () => {
        const html = renderToStaticMarkup(<ChallanPrint d={challan} />)
        expect(html).not.toContain('masthead branded')
        expect(html).not.toContain(LOGO)
    })

    it('resolves branding on the print page only for entitled organizations', () => {
        const page = read('app/(dashboard)/owner/dispatches/[id]/print/page.tsx')
        expect(page).toContain('orgHasDocumentBranding')
        expect(page).toContain("getDocumentBranding(")
        expect(page).toContain("'delivery_challan'")
    })
})

describe('entitlement and storage boundary', () => {
    it('gives document branding to Lite and Base, not Free', () => {
        expect(hasCapability('lite', 'document_branding')).toBe(true)
        expect(hasCapability('base', 'document_branding')).toBe(true)
        expect(hasCapability('free', 'document_branding')).toBe(false)
        expect(hasCapability('none', 'document_branding')).toBe(false)
    })

    it('checks owner role, plan and lock on the server for every branding change', () => {
        const access = read('lib/document-branding/access.server.ts')
        expect(access).toContain("requireRole(['owner'])")
        expect(access).toContain("hasCapability(")
        expect(access).toContain('assertOrgWritable')
        const actions = read('app/(dashboard)/owner/settings/document-branding-actions.ts')
        expect(actions.match(/requireBrandingManager\(\)/g)?.length).toBeGreaterThanOrEqual(6)
        expect(read('app/api/document-branding/logo/route.ts')).toContain('requireBrandingManager()')
    })

    it('keeps logos in a private bucket reachable only by the service role', () => {
        const migration = read('supabase/migrations/20261010190000_document_branding.sql')
        expect(migration).toMatch(/'document-branding',\s*'document-branding',\s*false/)
        expect(migration).toContain('ENABLE ROW LEVEL SECURITY')
        expect(migration).toContain('REVOKE ALL ON TABLE public.document_branding_logo_assets FROM PUBLIC, anon, authenticated')
        expect(migration).toContain('REVOKE ALL ON TABLE public.document_branding_settings FROM PUBLIC, anon, authenticated')
        for (const fn of ['activate_document_branding_logo', 'clear_document_branding_logo']) {
            expect(migration).toMatch(new RegExp(`FUNCTION public\\.${fn}[\\s\\S]*?SECURITY DEFINER[\\s\\S]*?SET search_path = ''`))
            expect(migration).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO service_role`))
        }
        expect(migration).toContain('one_active_per_org')
    })

    it('removes logo files after an account is deleted', () => {
        const deletion = read('app/(dashboard)/owner/settings/account-deletion.ts')
        expect(deletion.indexOf("rpc('delete_account_permanently'")).toBeLessThan(deletion.indexOf('removeOrganizationBrandingFiles(organization.id)'))
    })

    it('keeps the WASM tracer out of the server bundle so its file is traced', () => {
        expect(read('next.config.ts')).toContain("serverExternalPackages: ['@visioncortex/vtracer']")
    })
})
