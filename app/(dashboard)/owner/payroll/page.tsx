import { requireRole } from '@/lib/auth'
import { createPerfTimer } from '@/lib/perf'
import PayrollClient from './PayrollClient'
import { loadOwnerPayrollInitialData } from './loaders'

export default async function PayrollPage({
    searchParams,
}: {
    searchParams: Promise<{ cycle?: string | string[] }>
}) {
    const perf = createPerfTimer('/owner/payroll')
    const { profile } = await perf.measure('authSession', () => requireRole(['owner']), 0)
    const params = await searchParams
    const requestedMonth = typeof params.cycle === 'string' ? params.cycle : undefined
    const initialData = await perf.measure(
        'businessData',
        () => loadOwnerPayrollInitialData(profile.org_id, requestedMonth),
        11
    )

    perf.log({
        note: 'server initial payroll shares cycle logs, settlements, and advances across meter and fixed ledgers; pay-date overview is deferred',
    })

    return <PayrollClient initialData={initialData} />
}
