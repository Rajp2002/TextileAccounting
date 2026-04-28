import InventoryClient from './InventoryClient'
import { getInventoryModuleData } from './actions'

export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
    const { data, error } = await getInventoryModuleData()

    if (error || !data) {
        return (
            <div className="rounded-lg border bg-white p-6">
                <h1 className="text-xl font-semibold text-slate-900">Yarn + Beam Inventory</h1>
                <p className="mt-2 text-sm text-slate-600">
                    We could not load the inventory module right now.
                </p>
                {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
            </div>
        )
    }

    return <InventoryClient initialData={data} />
}
