import { Metadata } from 'next'
import { 
    getGrievances, 
    getNoticeRegistry, 
    getExportLogs, 
    getComplianceSettings,
    getDpaTemplates,
    getFactoryDpaStatus,
    getBreachReports
} from '@/lib/actions/compliance'
import { AdminDashboardUI } from './admin-ui'

export const metadata: Metadata = {
    title: 'Compliance Dashboard — Admin',
    description: 'Central command center for DPDP 2026 and Gujarat IT Policy compliance.',
}

export default async function AdminDashboardPage() {
    const [
        grievances, 
        notices, 
        exportLogs, 
        settings,
        dpaTemplates,
        factoryDpaStatus,
        breachReports
    ] = await Promise.all([
        getGrievances(),
        getNoticeRegistry(),
        getExportLogs(),
        getComplianceSettings(),
        getDpaTemplates(),
        getFactoryDpaStatus(),
        getBreachReports()
    ])

    return (
        <div className="p-6 lg:p-10 space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        Compliance Dashboard
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        Data Fiduciary Command Center (DPDP 2026)
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        factoryDpaStatus.some((f: any) => f.is_locked_down) 
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' 
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                    }`}>
                        {factoryDpaStatus.some((f: any) => f.is_locked_down) ? 'Incident Active' : 'Operational'}
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
            />
        </div>
    )
}
