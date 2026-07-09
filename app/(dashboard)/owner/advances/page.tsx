import { requireRole } from '@/lib/auth'
import { createPerfTimer } from '@/lib/perf'
import AdvancesClient from './AdvancesClient'
import { loadOwnerAdvancesInitialData } from './loaders'

export default async function AdvancesPage() {
    const perf = createPerfTimer('/owner/advances')
    const { profile } = await perf.measure('authSession', () => requireRole(['owner']), 0)
    const initialData = await perf.measure(
        'businessData',
        () => loadOwnerAdvancesInitialData(profile.org_id),
        3
    )

    perf.log({
        note: 'server initial advances shares active worker roster and pending overview; selected-worker detail remains deferred',
    })

    return <AdvancesClient initialData={initialData} />
}
