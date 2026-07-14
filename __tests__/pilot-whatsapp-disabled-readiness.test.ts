import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isWhatsAppDeliveryEnabled, resolveWhatsAppProvider } from '../lib/whatsapp-provider'

const source = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

describe('pilot WhatsApp-disabled readiness', () => {
    it('defaults absent and invalid provider configuration to disabled', () => {
        expect(resolveWhatsAppProvider(undefined)).toBe('disabled')
        expect(resolveWhatsAppProvider('')).toBe('disabled')
        expect(resolveWhatsAppProvider('unexpected')).toBe('disabled')
        expect(isWhatsAppDeliveryEnabled(undefined)).toBe(false)
        expect(resolveWhatsAppProvider('simulate')).toBe('simulate')
        expect(resolveWhatsAppProvider('meta')).toBe('meta')
    })

    it('does not contact Meta when provider configuration is disabled or incomplete', () => {
        const shared = source('supabase/functions/_shared/whatsapp.ts')
        expect(shared).toContain('return value === "simulate" || value === "meta" ? value : "disabled"')
        expect(shared).toContain('providerUnavailableResult("provider_disabled")')
        expect(shared).toContain('providerUnavailableResult("provider_unconfigured")')
        expect(shared.indexOf('provider === "disabled"')).toBeLessThan(shared.indexOf('await fetch(META_API'))
        expect(shared.indexOf('!accessToken || !phoneNumberId')).toBeLessThan(shared.indexOf('await fetch(META_API'))
    })

    it('uses an owner handoff instead of creating an inaccessible supervisor code', () => {
        const actions = source('app/(dashboard)/supervisor/actions.ts')
        const providerGuard = actions.indexOf('if (!isWhatsAppDeliveryEnabled())')
        const codeGeneration = actions.indexOf('generated = await generateAndStoreAccessCode', providerGuard)
        expect(providerGuard).toBeGreaterThan(-1)
        expect(actions.indexOf("delivery: 'manual_owner_handoff'", providerGuard)).toBeGreaterThan(providerGuard)
        expect(providerGuard).toBeLessThan(codeGeneration)
    })

    it('keeps pilot UI copy truthful when WhatsApp is unavailable', () => {
        const dashboard = source('app/(dashboard)/supervisor/dashboard/page.tsx')
        const machines = source('components/MachineManagement.tsx')
        const english = source('lib/i18n/locales/en.ts')
        expect(dashboard).toContain("result.delivery === 'manual_owner_handoff'")
        expect(machines).toContain("result.delivery === 'manual_owner_handoff'")
        expect(english).toContain('WhatsApp is unavailable. Ask the owner to generate an access code in Settings')
    })
})
