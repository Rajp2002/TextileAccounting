import { requireRole } from '@/lib/auth'
import { OrganizationDataExportButton } from '@/components/settings/organization-data-export-button'

export default async function OwnerDataExportPage() {
    await requireRole(['owner'])
    return (
        <main className="mx-auto max-w-2xl py-10">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Privacy & data</p>
                <h1 className="mt-2 text-2xl font-black text-slate-950">Export your organization data</h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                    This owner-only export remains available when plan access ends. It includes the current organization&apos;s records and redacts authentication, tracking, and other sensitive fields.
                </p>
                <div className="mt-6"><OrganizationDataExportButton /></div>
            </div>
        </main>
    )
}
