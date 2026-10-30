import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('create-order payment mode label', () => {
    it('labels the checkout attempt with the readiness mode', () => {
        expect(readFileSync('app/api/billing/create-order/route.ts', 'utf8')).toContain('provider_mode: billingReadiness.mode')
    })
})
