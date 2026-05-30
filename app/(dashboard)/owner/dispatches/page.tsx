import { getAllDispatches, getDispatchOverviewStats, getPendingStockSales } from "../orders/actions"
import DispatchesClient from "./DispatchesClient"

export const metadata = {
    title: "Dispatches | Owner Dashboard",
    description: "Monitor sent fabric dispatches and trader confirmations.",
}

export default async function DispatchesPage() {
    const [dispatchesResult, overviewResult, pendingSalesResult] = await Promise.all([
        getAllDispatches(),
        getDispatchOverviewStats(),
        getPendingStockSales(),
    ])
    const { data: dispatches, error } = dispatchesResult

    if (error || overviewResult.error || pendingSalesResult.error || !overviewResult.data || !pendingSalesResult.data) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-red-500">Error loading dispatches</h1>
                <p className="text-muted-foreground">{error || overviewResult.error || pendingSalesResult.error || 'Unable to load dispatch overview'}</p>
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <DispatchesClient
                initialDispatches={dispatches || []}
                initialOverview={overviewResult.data}
                initialPendingSales={pendingSalesResult.data}
            />
        </div>
    )
}
