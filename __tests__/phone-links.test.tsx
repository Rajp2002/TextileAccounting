import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { indianPhoneLinks } from '@/lib/phone'
import { ContactList } from '@/components/admin/contact-list'
import { readFileSync } from 'node:fs'

// Owners' mobiles are stored as 10 digits with no country code; links must add +91.
describe('indianPhoneLinks', () => {
    it('adds the India country code to stored 10-digit numbers', () => {
        expect(indianPhoneLinks('9876543210')).toEqual({ tel: 'tel:+919876543210', whatsapp: 'https://wa.me/919876543210', display: '+91 98765 43210' })
    })
    it('accepts numbers that already carry +91', () => {
        expect(indianPhoneLinks('+91 98765-43210')?.whatsapp).toBe('https://wa.me/919876543210')
    })
    it('returns null for anything that is not an Indian mobile', () => {
        expect(indianPhoneLinks('12345')).toBeNull()
        expect(indianPhoneLinks(null)).toBeNull()
    })
})

describe('contact links use the India country code', () => {
    it('Today contact rows', () => {
        const html = renderToStaticMarkup(<ContactList title="Trials ending" seeAllHref="/x" empty="None" rows={[{
            orgId: 'o1', factory: 'Synthetic Weaving', ownerName: 'Ramesh', phone: '9876543210', detail: 'Ends in 3 days', at: null, minutesLast30: 0, costingsSaved: 0,
        }]}/>)
        expect(html).toContain('href="tel:+919876543210"')
        expect(html).toContain('href="https://wa.me/919876543210"')
    })
    it('factory page uses the shared helper', () => {
        expect(readFileSync('app/(admin-console)/admin/factories/[orgId]/page.tsx', 'utf8')).toContain('<PhoneLinks phone={factory.contact.ownerPhone}')
    })
})
