import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ContactList } from '@/components/admin/contact-list'
import type { ContactRow } from '@/lib/admin/growth-usage'

const row = (overrides: Partial<ContactRow> = {}): ContactRow => ({
    orgId: `org-${Math.random()}`, factory: 'Synthetic Weaving', ownerName: 'Ramesh', phone: '+919800000001',
    detail: 'Ends in 3 days', at: '2026-12-04T00:00:00Z', minutesLast30: 42, costingsSaved: 5, ...overrides,
})

describe('ContactList', () => {
    it('links phone and WhatsApp, and degrades without a phone', () => {
        const html = renderToStaticMarkup(<ContactList title="Trials ending" seeAllHref="/admin/metrics/accounts?list=trials_ending" empty="No trials end in the next 14 days." rows={[row(), row({ phone: null, factory: 'No Phone Mills' })]}/>)
        expect(html).toContain('href="tel:+919800000001"')
        expect(html).toContain('href="https://wa.me/919800000001"')
        expect(html).toContain('No mobile on file')
        expect(html).toContain('Ends in 3 days')
        expect(html).toContain('42 min in 30 days')
        expect(html).toContain('href="/admin/metrics/accounts?list=trials_ending"')
    })
    it('shows the empty text when there is nobody to contact', () => {
        expect(renderToStaticMarkup(<ContactList title="Renewals due" seeAllHref="/x" empty="No renewals due in the next 30 days." rows={[]}/>)).toContain('No renewals due in the next 30 days.')
    })
})

describe('Today page', () => {
    it('renders Customers to contact above Needs attention', () => {
        const src = readFileSync('app/(admin-console)/admin/page.tsx', 'utf8')
        expect(src.indexOf('Customers to contact')).toBeGreaterThan(0)
        expect(src.indexOf('Customers to contact')).toBeLessThan(src.indexOf('Needs attention'))
    })
})
