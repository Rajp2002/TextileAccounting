import 'server-only'

import {
    getAllDispatches,
    getDispatchOverviewStats,
    getOpenStockDiscrepancies,
    getPendingStockSales,
} from '../orders/actions'

export async function loadOwnerDispatchesInitialData() {
    // Start this organization-wide read before the dependent read models. The
    // same promise is consumed by the active/archived classification and the
    // overview totals, so the first render does not issue it twice.
    const openDiscrepancies = getOpenStockDiscrepancies()
    const [dispatchesResult, overviewResult, pendingSalesResult] = await Promise.all([
        getAllDispatches({ preloadedOpenDiscrepancies: openDiscrepancies }),
        getDispatchOverviewStats({ preloadedOpenDiscrepancies: openDiscrepancies }),
        getPendingStockSales(),
    ])

    const error = dispatchesResult.error || overviewResult.error || pendingSalesResult.error
    if (error || !overviewResult.data || !pendingSalesResult.data) {
        return { error: error || 'Unable to load dispatch overview' }
    }

    return {
        data: {
            dispatches: dispatchesResult.data ?? [],
            overview: overviewResult.data,
            pendingSales: pendingSalesResult.data,
        },
    }
}
