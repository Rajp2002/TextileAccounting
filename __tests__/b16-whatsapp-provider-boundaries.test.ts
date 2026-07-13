import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

describe('B16 WhatsApp provider boundaries', () => {
    const shared = source('supabase/functions/_shared/whatsapp.ts')
    const secrets = source('supabase/functions/_shared/secrets.ts')
    const advance = source('supabase/functions/send-advance-receipt/index.ts')
    const payslip = source('supabase/functions/send-payslip/index.ts')
    const accessCode = source('supabase/functions/send-access-code/index.ts')
    const retryWorker = source('supabase/functions/retry-failed-messages/index.ts')
    const dailyBrief = source('supabase/functions/send-daily-brief/index.ts')
    const monthlyBrief = source('supabase/functions/monthly-brief/index.ts')
    const ownerActions = source('app/(dashboard)/owner/actions.ts')
    const advanceActions = source('app/(dashboard)/owner/advances/actions.ts')
    const migration = source('supabase/migrations/20260714073000_b16_whatsapp_delivery_boundaries.sql')

    it('supports deterministic success timeout failure rejection and expired-token simulation only in simulator provider mode', () => {
        expect(shared).toContain('provider === "simulate"')
        for (const mode of ['success', 'timeout', 'provider_failure', 'template_rejected', 'expired_token']) {
            expect(shared).toContain(`"${mode}"`)
        }
        expect(shared).toContain('requestedSimulationMode ?? Deno.env.get("WHATSAPP_SIMULATION_MODE")')
        expect(shared).toContain('use the manual fallback')
    })

    it('accepts both current and legacy Supabase admin keys for internal function calls', () => {
        expect(secrets).toContain('function isAcceptedInternalSecret')
        expect(secrets).toContain('Deno.env.get("INTERNAL_FUNCTION_SECRET")')
        expect(secrets).toContain('Deno.env.get("SUPABASE_SECRET_KEY")')
        expect(secrets).toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")')
        expect(secrets).toContain('...getSupabaseSecretsFromDictionary()')
        expect(secrets).toContain('isAcceptedInternalSecret(presented)')
    })

    it('binds worker consent to the same tenant and exact normalized phone', () => {
        expect(shared).toContain(".eq('org_id', orgId)")
        expect(shared).toContain(".select('consent_status, phone')")
        expect(shared).toContain('reason: "phone_mismatch"')
        expect(migration).toContain("'skipped_phone_mismatch'")
    })

    it('logs opted-out missing-consent missing-phone and phone-mismatch skips without rolling back the advance', () => {
        expect(advance).toContain('status: "skipped_missing_phone"')
        expect(advance).toContain('status: `skipped_${consentResult.reason}`')
        expect(payslip).toContain('status: "skipped_missing_phone"')
        expect(payslip).toContain('status: `skipped_${consentResult.reason}`')
        expect(advanceActions.indexOf(".from('worker_advances')\n        .insert(record)")).toBeLessThan(
            advanceActions.indexOf('/functions/v1/send-advance-receipt')
        )
        expect(advanceActions).toContain('return { \n        success: true')
    })

    it('keeps access-code delivery tenant-bound opted-in and free of plaintext code snapshots', () => {
        expect(accessCode).toContain('.eq("org_id", org_id)')
        expect(accessCode).toContain('const consentResult = await checkWhatsAppConsent')
        expect(accessCode).toContain('"skipped_missing_phone"')
        expect(accessCode).not.toContain('payloadSnapshot: { code')
    })

    it('preserves summary-first payslip itemization and logs freeform fallback failure', () => {
        expect(payslip).toContain('if (templateResult.success)')
        expect(payslip).toContain('detail_sent: freeformResult.success')
        expect(payslip).toContain('notificationType: "payslip_details_fallback"')
        expect(payslip).toContain('freeform_simulation_mode ?? simulation_mode')
    })

    it('never resets retry history and targets a single tenant log', () => {
        expect(ownerActions).toContain("select('id, org_id, status, retry_count, sent_at')")
        expect(ownerActions).toContain("Maximum retry limit reached")
        expect(ownerActions).toContain("older than 24 hours")
        expect(ownerActions).not.toContain('retry_count: 0')
        expect(retryWorker).toContain('.eq("id", body.log_id).eq("org_id", body.org_id)')
        expect(retryWorker).toContain('.eq("retry_count", row.retry_count ?? 0)')
        expect(migration).toContain('CHECK (retry_count BETWEEN 0 AND 3)')
    })

    it('keeps deadline daily and monthly idempotency at independent grains', () => {
        expect(dailyBrief).toContain('alert_type: "daily_brief"')
        expect(dailyBrief).toContain('alert_type: "deadline_risk"')
        expect(dailyBrief).toContain('lockError.code === "23505"')
        expect(monthlyBrief).toContain(".eq('brief_type', 'monthly')")
        expect(monthlyBrief).toContain("brief_type: 'monthly'")
        expect(migration).toContain('UNIQUE (org_id, report_date, brief_type)')
    })
})
