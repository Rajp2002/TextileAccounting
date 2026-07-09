import DispatchesClient from "./DispatchesClient"
import { requireRole } from '@/lib/auth'
import { createPerfTimer } from '@/lib/perf'
import { loadOwnerDispatchesInitialData } from './loaders'

export const metadata = {
    title: "Dispatches | Owner Dashboard",
    description: "Monitor sent fabric dispatches and trader confirmations.",
}

export default async function DispatchesPage() {
    const perf = createPerfTimer('/owner/dispatches')
    await perf.measure('authSession', () => requireRole(['owner']), 0)
    const initialData = await perf.measure(
        'businessData',
        () => loadOwnerDispatchesInitialData(),
        4
    )
    perf.log({ note: 'server initial payload shares one open stock_discrepancies read across active dispatches and overview totals' })

    if ('error' in initialData) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-red-500">Error loading dispatches</h1>
                <p className="text-muted-foreground">{initialData.error}</p>
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <DispatchesClient
                initialDispatches={initialData.data.dispatches}
                initialOverview={initialData.data.overview}
                initialPendingSales={initialData.data.pendingSales}
            />
        </div>
    )
}
