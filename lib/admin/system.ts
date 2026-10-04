import 'server-only'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBillingReadiness } from '@/lib/billing-readiness'
import { adminRecordAudit, requireFounder } from './founder'

export type SystemItem = { id: string; orgId: string | null; observedAt: string; reason: string; severity: 'critical' | 'high' | 'normal'; href: string }
export type SystemSignal = { key: string; label: string; state: 'observed' | 'unavailable'; count: number | null; checkedAt: string; latestAt: string | null; detail: string; items: SystemItem[] }

/** Existing retained registers are diagnostic evidence, not complete monitoring coverage. */
export async function getAdminSystem() {
    const principal = await requireFounder(), requestId = randomUUID(), asOf = new Date().toISOString()
    const db = createAdminClient()
    const reads = await Promise.allSettled([
        db.from('razorpay_webhook_events').select('event_id,event_type,status,received_at,updated_at', { count: 'exact' }).in('status', ['processing', 'failed']).order('received_at').limit(25),
        db.from('security_incidents').select('id,org_id,status,severity,aware_at', { count: 'exact' }).neq('status', 'closed').in('severity', ['critical', 'high']).order('aware_at').limit(25),
        db.from('organization_export_runs').select('id,org_id,status,exported_at', { count: 'exact' }).eq('status', 'failed').order('exported_at', { ascending: false }).limit(25),
    ])
    const specifications = [
        { key: 'billing_events', label: 'Payment events awaiting processing', detail: 'Retained processing/failed webhook records. This read never retries an event or repairs access.' },
        { key: 'security_incidents', label: 'Open high-impact security incidents', detail: 'Safe references from the current incident register; formal operations retain their separate process.' },
        { key: 'exports', label: 'Recorded export failures', detail: 'Retained failed export attempts; no complete workflow success rate is inferred.' },
    ]
    const signals: SystemSignal[] = reads.map((read, index) => {
        const spec = specifications[index]
        if (read.status !== 'fulfilled' || read.value.error || !Array.isArray(read.value.data)) return { ...spec, state: 'unavailable', count: null, checkedAt: asOf, latestAt: null, detail: 'Source unavailable. This signal cannot establish health.', items: [] }
        const items: SystemItem[] = read.value.data.map((raw: Record<string, unknown>) => ({
            id: `${spec.key}:${raw.id ?? raw.event_id}`, orgId: typeof raw.org_id === 'string' ? raw.org_id : null,
            observedAt: String(raw.aware_at ?? raw.exported_at ?? raw.received_at),
            reason: index === 0 ? `Payment event ${raw.status === 'failed' ? 'failed processing' : 'is awaiting processing'}.`
                : index === 1 ? `Open ${raw.severity} incident requires review.` : 'An export attempt failed; inspect its protected diagnostic reference.',
            severity: index === 1 && raw.severity === 'critical' ? 'critical' : index === 2 ? 'normal' : 'high',
            href: index === 1 ? '/admin/legacy#incidents' : index === 2 && typeof raw.org_id === 'string' ? `/admin/factories/${raw.org_id}` : '/admin/payments',
        }))
        return { ...spec, state: 'observed', count: read.value.count ?? items.length, checkedAt: asOf, latestAt: items.map(item => item.observedAt).sort().at(-1) ?? null, items }
    })
    const readiness = getBillingReadiness()
    await adminRecordAudit(principal, 'system.read', 'system', 'signals', requestId, { after: { count: signals.length, mode: readiness.mode } })
    return { asOf, requestId, signals, readiness: { mode: readiness.mode, code: readiness.code, message: readiness.publicMessage },
        monitoring: { state: 'unavailable' as const, detail: 'Workflow success rate, request volume and p95 latency are not connected to a verified monitoring feed.' },
        syntheticCheck: { state: 'unavailable' as const, detail: 'An authorized representative login/read/write check is not connected.' },
        backup: { state: 'unavailable' as const, lastSuccessfulAt: null, detail: 'Backup status source not connected.' },
        restore: { state: 'unavailable' as const, lastSuccessfulTestAt: null, detail: 'Restore-test evidence source not connected.' },
        coverage: 'These are current reads of retained registers. No failures, or no traffic, does not establish a healthy service.' }
}
