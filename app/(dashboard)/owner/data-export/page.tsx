import styles from './lite-export.module.css'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { requireRole } from '@/lib/auth'
import { OrganizationDataExportButton } from '@/components/settings/organization-data-export-button'
import { AccountantCsvExports } from './AccountantCsvExports'

export default async function OwnerDataExportPage() {
    // Reachable after paid access ends; the layout keeps pure Free accounts out.
    const { profile } = await requireRole(['owner'], { allowFreeAccount: true })
    const plan = await getCachedOrgPlanAccess(profile.org_id)
    return (
        <main className={`mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10 ${plan.effectiveTier === 'lite' ? styles.root : ''}`}>
            <div className="rounded-2xl border border-wv-border-default bg-surface p-6 shadow-sm sm:p-8">
                <h1 className="text-center text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:text-[2rem]">Export your complete organization data</h1>
                <p className="mt-3 text-sm leading-6 text-body">
                    This owner-only JSON export remains available when plan access ends. It includes the current organization&apos;s operational, costing, billing, privacy, and export-history records, while redacting authentication, tracking, and other sensitive fields.
                </p>
                <div className="mt-6"><OrganizationDataExportButton showHistory testId="owner-data-export" /></div>
                <AccountantCsvExports />
            </div>
        </main>
    )
}
