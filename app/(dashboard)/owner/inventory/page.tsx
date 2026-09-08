import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { getInventoryModuleData } from './actions'
import OwnerInventoryClient from './OwnerInventoryClient'

export const dynamic = 'force-dynamic'
export default async function InventoryPage() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createClient()
    const [{ data: inventoryData, error: inventoryError }, orgRes] = await Promise.all([
        getInventoryModuleData(),
        supabase.from('organizations').select('beam_tracking_enabled').eq('id', profile.org_id).single(),
    ])
    if (inventoryError || !inventoryData) {
        return <div className="rounded-lg border bg-white p-6"><h1 className="text-xl font-semibold">Inventory</h1><p className="mt-2 text-sm">We could not load the inventory module right now.</p></div>
    }
    return <OwnerInventoryClient inventoryData={inventoryData} beamTrackingEnabled={!!orgRes.data?.beam_tracking_enabled} />
}
