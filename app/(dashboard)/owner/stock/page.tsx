import { getFabricStockBoard } from './actions'
import StockClient from './StockClient'

export const dynamic = 'force-dynamic'

export default async function StockPage() {
    const data = await getFabricStockBoard()

    if ('error' in data) {
        return (
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-rose-600">Unable to load stock</h1>
                <p className="text-sm text-slate-500">{data.error}</p>
            </div>
        )
    }

    return <StockClient initialData={data} />
}
