import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const proxy = readFileSync(join(process.cwd(), 'proxy.ts'), 'utf8')
const onboardingGuardStart = proxy.indexOf("if (\n            role === 'owner'")
const onboardingGuardEnd = proxy.indexOf("if (role === 'owner' && onboardingComplete && pathname === '/onboarding')")
const incompleteOwnerGuard = proxy.slice(onboardingGuardStart, onboardingGuardEnd)

describe('Base routes during estimator-only onboarding', () => {
    it('keeps every paid Base surface reachable before factory onboarding is complete', () => {
        expect(onboardingGuardStart).toBeGreaterThan(-1)
        expect(onboardingGuardEnd).toBeGreaterThan(onboardingGuardStart)

        for (const route of [
            '/owner/billing',
            '/owner/estimator',
            '/owner/quotes',
            '/owner/rates',
            '/owner/production',
            '/owner/assignments',
            '/owner/machines',
            '/owner/workers',
            '/owner/payroll',
            '/owner/stock',
            '/owner/dispatches',
            '/owner/settings',
        ]) {
            expect(incompleteOwnerGuard).toContain(`!pathname.startsWith('${route}')`)
        }
    })
})
