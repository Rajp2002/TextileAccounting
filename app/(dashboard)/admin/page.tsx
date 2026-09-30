import { Metadata } from 'next'
import { 
    getGrievances, 
    getNoticeRegistry, 
    getExportLogs, 
    getComplianceSettings,
    getDpaTemplates,
    getFactoryDpaStatus,
    getBreachReports,
    getSecurityIncidents
} from '@/lib/actions/compliance'
import { AdminDashboardUI } from './admin-ui'
import { createSignInServerTimerFromCookie } from '@/lib/sign-in-telemetry.server'

export const metadata: Metadata = {
    title: 'Compliance Dashboard — Admin',
    description: 'Internal compliance, grievance, and security-incident operations dashboard.',
}

type FactoryDpaStatusSummary = {
    is_locked_down?: boolean
}

export default async function AdminDashboardPage() {
    const signInTelemetry = await createSignInServerTimerFromCookie('sign_in_dashboard_data')
    const [
        grievances,
        notices,
        exportLogs,
        settings,
        dpaTemplates,
        factoryDpaStatus,
        breachReports,
        securityIncidents
    ] = await signInTelemetry.measure('dashboard_queries', () => Promise.all([
        getGrievances(),
        getNoticeRegistry(),
        getExportLogs(),
        getComplianceSettings(),
        getDpaTemplates(),
        getFactoryDpaStatus(),
        getBreachReports(),
        getSecurityIncidents()
    ]))
    const hasLockedFactory = (factoryDpaStatus as FactoryDpaStatusSummary[]).some((f) => f.is_locked_down)
    signInTelemetry.log('success', { route: '/admin' })

    return (
        <div className="p-6 lg:p-10 space-y-8">
            <span hidden data-signin-ready="true" />
            <header className="grid gap-4 border-b border-hairline/80 pb-5 text-center sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                <h1 className="text-[1.75rem] font-bold tracking-tight text-ink sm:col-start-2 sm:row-start-1 sm:text-[2rem]">
                    Compliance Dashboard
                </h1>
                <div className="flex items-center justify-center gap-3 sm:col-start-3 sm:row-start-1 sm:justify-self-end">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        hasLockedFactory
                        ? 'bg-wv-status-warning-bg text-wv-status-warning-fg'
                        : 'bg-wv-status-success-bg text-wv-status-success-fg'
                    }`}>
                        {hasLockedFactory ? 'Incident Active' : 'Operational'}
                    </span>
                </div>
            </header>

            <AdminDashboardUI 
                initialGrievances={grievances}
                initialNotices={notices}
                initialExportLogs={exportLogs}
                initialSettings={settings}
                initialDpaTemplates={dpaTemplates}
                initialFactoryDpaStatus={factoryDpaStatus}
                initialBreachReports={breachReports}
                initialSecurityIncidents={securityIncidents}
            />
        </div>
    )
}
