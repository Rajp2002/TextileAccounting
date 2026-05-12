import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('WhatsApp Consent Guard Tests (Static Analysis)', () => {
    const whatsappShared = readProjectFile('supabase/functions/_shared/whatsapp.ts')
    const sendPayslip = readProjectFile('supabase/functions/send-payslip/index.ts')
    const sendAdvance = readProjectFile('supabase/functions/send-advance-receipt/index.ts')
    const ownerActions = readProjectFile('app/(dashboard)/owner/actions.ts')

    it('defines checkWhatsAppConsent with correct return type', () => {
        expect(whatsappShared).toContain('export async function checkWhatsAppConsent')
        expect(whatsappShared).toContain('reason: "opted_in" | "opted_out" | "missing_consent" | "missing_phone" | "unsupported_person_type"')
    })

    it('integrates consent check in send-payslip', () => {
        expect(sendPayslip).toContain('const consentResult = await checkWhatsAppConsent')
        expect(sendPayslip).toContain('if (!consentResult.allowed)')
        expect(sendPayslip).toContain('status: `skipped_${consentResult.reason}`')
    })

    it('integrates consent check in send-advance-receipt', () => {
        expect(sendAdvance).toContain('const consentResult = await checkWhatsAppConsent')
        expect(sendAdvance).toContain('if (!consentResult.allowed)')
        expect(sendAdvance).toContain('status: `skipped_${consentResult.reason}`')
    })

    it('handles opt-out in updateMeterWorker', () => {
        expect(ownerActions).toContain("consent_status: isOptIn ? 'opted_in' : 'opted_out'")
        expect(ownerActions).toContain("withdrawn_at: isOptIn ? null : new Date().toISOString()")
    })

    it('handles opt-out in upsertFixedWorker', () => {
        expect(ownerActions).toContain("consent_status: isOptIn ? 'opted_in' : 'opted_out'")
    })

    it('handles opt-out in saveWorkerWhatsApp', () => {
        expect(ownerActions).toContain("consent_status: isOptIn ? 'opted_in' : 'opted_out'")
    })
})
