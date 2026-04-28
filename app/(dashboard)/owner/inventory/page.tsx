import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { getInventoryModuleData } from './actions'
import { getFabricStockBoard } from '../stock/actions'
import OwnerInventoryClient from './OwnerInventoryClient'

export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createClient()

    const [{ data: inventoryData, error: inventoryError }, stockData, orgRes] = await Promise.all([
        getInventoryModuleData(),
        getFabricStockBoard(),
        supabase
            .from('organizations')
            .select('beam_tracking_enabled')
            .eq('id', profile.org_id)
            .single(),
    ])

    if (inventoryError || !inventoryData) {
        return (
            <div className="rounded-lg border bg-white p-6">
                <h1 className="text-xl font-semibold text-slate-900">Inventory</h1>
                <p className="mt-2 text-sm text-slate-600">
                    We could not load the inventory module right now.
                </p>
                {inventoryError ? <p className="mt-3 text-sm text-rose-600">{inventoryError}</p> : null}
            </div>
        )
    }

    if ('error' in stockData) {
        return (
            <div className="rounded-lg border bg-white p-6">
                <h1 className="text-xl font-semibold text-slate-900">Inventory</h1>
                <p className="mt-2 text-sm text-slate-600">
                    We could not load grey stock right now.
                </p>
                <p className="mt-3 text-sm text-rose-600">{stockData.error}</p>
            </div>
        )
    }

    return (
        <OwnerInventoryClient
            inventoryData={inventoryData}
            stockData={stockData}
            beamTrackingEnabled={!!orgRes.data?.beam_tracking_enabled}
        />
    )
}
