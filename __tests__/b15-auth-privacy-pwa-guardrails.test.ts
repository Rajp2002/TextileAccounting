import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function source(path: string) {
    return readFileSync(path, 'utf8')
}

describe('B15 authentication, privacy, accessibility, and PWA guardrails', () => {
    const proxy = source('proxy.ts')
    const rateLimit = source('lib/rate-limit.ts')
    const resetForm = source('app/(auth)/reset-password/ResetPasswordForm.tsx')
    const settings = source('app/(dashboard)/owner/settings/page.tsx')
    const exportAction = source('app/(dashboard)/owner/settings/data-export.ts')
    const erasureAction = source('app/(dashboard)/owner/actions/compliance.ts')
    const erasureMigration = source('supabase/migrations/20260714063000_b15_atomic_worker_erasure.sql')
    const attendance = source('app/(dashboard)/supervisor/attendance/page.tsx')
    const orderCards = source('app/(dashboard)/owner/orders/OrdersClient.tsx')
    const auditActivity = source('app/(dashboard)/owner/settings/audit/AuditActivityItem.tsx')
    const manifest = source('app/manifest.ts')
    const pwaUpdate = source('components/pwa-update-notice.tsx')

    it('keeps the inactivity timestamp past one hour so an idle session is rejected', () => {
        expect(proxy).toContain('if (timeSinceLastActivity > 3600000)')
        expect(proxy).toContain('maxAge: 7 * 24 * 60 * 60')
        expect(proxy).toContain("response.cookies.delete('last_activity')")
        expect(proxy).toContain('getClientIpFromHeaders(request.headers)')
    })

    it('isolates auth rate-limit keys by the Vercel-normalized client IP', () => {
        expect(rateLimit).toContain("headerList.get('x-forwarded-for')?.split(',')[0]?.trim()")
        expect(rateLimit).toContain("const result = await checkRateLimit(limiterFn, `${keyPrefix}:${ip}`)")
        expect(proxy).toContain('getClientIpFromHeaders(request.headers)')
    })

    it('keeps reset controls keyboard reachable and only changes a password from a session', () => {
        expect(resetForm).toContain('supabase.auth.getSession()')
        expect(resetForm).toContain('supabase.auth.updateUser({ password })')
        expect(resetForm).toContain('supabase.auth.signOut()')
        expect(resetForm).not.toContain('tabIndex={-1}')
    })

    it('keeps data export available outside premium presentation and fail-closed on audit', () => {
        expect(settings.match(/Download Data Export/g)?.length).toBe(1)
        expect(settings).toContain('<SettingsSection id="privacy-data"')
        expect(settings.indexOf('<SettingsSection id="privacy-data"')).toBeLessThan(settings.indexOf('{hasPremium ? <aside'))
        expect(exportAction).toContain("const { user, profile } = await requireRole(['owner'])")
        expect(exportAction).toContain("supabase.rpc('log_export_event'")
        expect(exportAction).toContain("throw new Error('Data export could not be audited. Please try again.')")
    })

    it('performs tenant-bound erasure and audit-payload redaction in one database transaction', () => {
        expect(erasureAction).toContain("supabase.rpc('erase_worker_pii_atomic'")
        expect(erasureMigration).toContain('auth.uid() <> p_actor_id')
        expect(erasureMigration).toContain("p.role = 'owner'")
        expect(erasureMigration).toContain("name = 'ERASED WORKER'")
        expect(erasureMigration).toContain('date_of_birth = NULL')
        expect(erasureMigration).toContain('age_verification_reference = NULL')
        expect(erasureMigration).toContain("payload_snapshot = jsonb_build_object('erased', TRUE)")
        expect(erasureMigration).toContain("jsonb_build_object('name', '[ERASED]')")
        expect(erasureMigration).toContain("old_data - 'client_ip'")
        expect(erasureMigration).toContain("action, new_data, changed_by, changed_at")
        expect(erasureMigration).toContain("'history_rows_preserved', v_history_rows")
        expect(erasureMigration).not.toMatch(/DELETE\s+FROM\s+public\.(production_logs|payroll|audit_log)/i)
    })

    it('keeps core click targets keyboard operable', () => {
        expect(attendance).toContain('<button')
        expect(attendance).toContain('aria-pressed={isPresent}')
        expect(orderCards).toContain('tabIndex={0}')
        expect(orderCards).toContain("event.key === 'Enter' || event.key === ' '")
        expect(auditActivity).toContain('aria-expanded={isExpanded}')
        expect(auditActivity).toContain('type="button"')
    })

    it('retains install scope, icons, standalone mode, and explicit update activation', () => {
        expect(manifest).toContain("start_url: '/owner/estimator'")
        expect(manifest).toContain("scope: '/'")
        expect(manifest).toContain("display: 'standalone'")
        expect(manifest).toContain("src: '/icon-192x192.png?v=3'")
        expect(manifest).toContain("src: '/icon-512x512.png?v=3'")
        expect(pwaUpdate).toContain("waitingWorker.postMessage({ type: 'SKIP_WAITING' })")
        expect(pwaUpdate).toContain("navigator.serviceWorker.addEventListener('controllerchange'")
        expect(pwaUpdate).toContain('registration.update()')
    })

    it('has no user-data HTML sink outside the reviewed static root script', () => {
        const userFacingSources = [
            source('app/(dashboard)/owner/orders/OrdersClient.tsx'),
            source('app/(dashboard)/owner/dispatches/DispatchesClient.tsx'),
            source('app/(dashboard)/owner/fixed-workers/page.tsx'),
            source('app/(dashboard)/owner/estimator/EstimatorClient.tsx'),
            source('app/(dashboard)/owner/stock/TakaStockClient.tsx'),
        ]
        for (const file of userFacingSources) {
            expect(file).not.toContain('dangerouslySetInnerHTML')
            expect(file).not.toMatch(/\.innerHTML\s*=/)
        }
    })
})
