import { Metadata } from 'next'
import {
    getGrievances,
    getNoticeRegistry,
    getExportLogs,
    getDpaTemplates,
    getFactoryDpaStatus,
    getBreachReports,
    getSecurityIncidents
} from '@/lib/actions/compliance'
import { createSignInServerTimerFromCookie } from '@/lib/sign-in-telemetry.server'
import { requireFounderPage } from '@/lib/admin/founder'
import { AdminEmptyState, AdminPageHeader, AdminSurface } from '@/components/admin/primitives'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
    title: 'Formal operations',
    description: 'Retained read-only privacy and security workflow sources.',
}

function observedCount(records: unknown): string {
    return Array.isArray(records) ? records.length.toLocaleString('en-IN') : 'Unavailable'
}

export default async function AdminDashboardPage() {
    await requireFounderPage()
    if (process.env.WEAVLY_ADMIN_LEGACY_READS_ENABLED !== 'true') {
        return <><AdminPageHeader title="Formal operations" description="The previous console is retained while current privacy and security workflows are reviewed."/><AdminSurface><AdminEmptyState title="Fallback access is awaiting review" description="Legacy records and services are preserved. The retained read view is disabled until its operational owner and access requirements are confirmed; high-impact changes remain separately gated."/></AdminSurface></>
    }
    const signInTelemetry = await createSignInServerTimerFromCookie('sign_in_dashboard_data')
    const [
        grievances,
        notices,
        exportLogs,
        dpaTemplates,
        factoryDpaStatus,
        breachReports,
        securityIncidents
    ] = await signInTelemetry.measure('dashboard_queries', () => Promise.all([
        getGrievances(),
        getNoticeRegistry(),
        getExportLogs(),
        getDpaTemplates(),
        getFactoryDpaStatus(),
        getBreachReports(),
        getSecurityIncidents()
    ]))
    signInTelemetry.log('success', { route: '/admin/legacy' })
    const sources = [
        ['Privacy grievances', grievances], ['Published notice records', notices],
        ['Data-request export history', exportLogs], ['DPA template records', dpaTemplates],
        ['Factory DPA workflow records', factoryDpaStatus], ['Retained breach reports', breachReports],
        ['Security incident records', securityIncidents],
    ] as const

    return (
        <div>
            <span hidden data-signin-ready="true" />
            <AdminPageHeader title="Formal operations" description="A retained source inventory for reviewed privacy and security workflows. Record counts do not establish current compliance or system health."/>
            <AdminSurface aria-label="Retained formal sources"><dl className="divide-y divide-hairline">{sources.map(([label, records]) => <div key={label} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><dt className="text-sm text-body">{label}</dt><dd className="text-sm font-semibold tabular-nums">{observedCount(records)}</dd></div>)}</dl></AdminSurface>
            <p className="mt-5 text-sm leading-6 text-subtle">The previous screen remains reference material. Changes, exports and incident controls require a separately approved operational path; they are not exposed in this read view.</p>
        </div>
    )
}
