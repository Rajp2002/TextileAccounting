import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BarList, NotYet, RateText, formatRupees } from '@/components/admin/metrics-ui'
import { safeFounderReturnPath } from '@/lib/admin/routes'

const page = () => readFileSync('app/(admin-console)/admin/metrics/page.tsx', 'utf8')

describe('Metrics navigation', () => {
    it('nav and return paths include Metrics', () => {
        expect(readFileSync('components/admin/founder-shell.tsx', 'utf8')).toContain("'/admin/metrics'")
        expect(safeFounderReturnPath('/admin/metrics')).toBe('/admin/metrics')
        expect(safeFounderReturnPath('/admin/metrics/accounts')).toBe('/admin/metrics/accounts')
    })
})

describe('Metrics page source', () => {
    it('has the sections in order and shows Starts at go-live before go-live', () => {
        const src = page()
        const order = ['Money', 'Accounts', 'Getting started', 'Usage', 'Keeping customers'].map(heading => src.indexOf(`title="${heading}"`))
        expect(order.every((index, n) => index > 0 && (n === 0 || index > order[n - 1]))).toBe(true)
        expect(src).toContain('<NotYet')
        expect(src).toContain('Wanted to pay')
    })
    it('every count links to the accounts list', () => {
        expect(page()).toContain('/admin/metrics/accounts?list=')
    })
    it('a load failure shows one notice instead of a half-empty page', () => {
        expect(page()).toContain("Metrics couldn't be loaded")
    })
})

describe('metrics UI', () => {
    it('RateText shows None yet for empty denominators and counts beside percents', () => {
        expect(renderToStaticMarkup(<RateText rate={{ count: 0, of: 0, percent: null }}/>)).toContain('None yet')
        expect(renderToStaticMarkup(<RateText rate={{ count: 3, of: 5, percent: 60 }}/>)).toContain('3 of 5 · 60%')
    })
    it('NotYet defaults to Starts at go-live', () => {
        expect(renderToStaticMarkup(<NotYet/>)).toContain('Starts at go-live')
    })
    it('BarList prints every value and handles a negative month', () => {
        const html = renderToStaticMarkup(<BarList rows={[{ label: 'Jan', value: -50000, display: '−₹500' }, { label: 'Dec', value: 299900, display: '₹2,999' }]}/>)
        expect(html).toContain('−₹500')
        expect(html).toContain('₹2,999')
        expect(html).toContain('Jan')
    })
    it('formats paise as whole rupees, with a minus sign for negatives', () => {
        expect(formatRupees(299900)).toBe('₹2,999')
        expect(formatRupees(-50000)).toBe('−₹500')
        expect(formatRupees(12345678)).toBe('₹1,23,457')
    })
})
