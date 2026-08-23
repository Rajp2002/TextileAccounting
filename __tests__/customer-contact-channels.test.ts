import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { LEGAL_OPERATOR } from '../lib/legal-operator'

const root = process.cwd()
const activeContactSurfaces = [
    'app/privacy/page.tsx',
    'app/privacy-request/page.tsx',
    'app/terms/page.tsx',
    'app/refund-policy/page.tsx',
    'components/landing/footer.tsx',
    'lib/generate-payment-receipt.ts',
    'app/(auth)/actions/auth.ts',
    'app/locked/page.tsx',
    'components/settings/EmergencyLockdown.tsx',
]

describe('customer-facing contact channels', () => {
    it('uses the monitored interim contact address', () => {
        expect(LEGAL_OPERATOR.contactEmail).toBe('rajpatel86420@gmail.com')
    })

    it.each(activeContactSurfaces)('%s uses the centralized contact', (relativePath) => {
        const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
        expect(source).toContain('LEGAL_OPERATOR.contactEmail')
    })

    it('does not direct customers to inactive Weavly inboxes', () => {
        const activeSource = activeContactSurfaces
            .map((relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8'))
            .join('\n')

        expect(activeSource).not.toMatch(/(?:support|legal|privacy)@weavly\.app/i)
        expect(activeSource).not.toContain('Please contact support.')
        expect(activeSource).not.toContain('Contact support to initiate')
    })
})
