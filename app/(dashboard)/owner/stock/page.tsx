import { getTakaStockBoard } from './actions'
import TakaStockClient from './TakaStockClient'

export const dynamic = 'force-dynamic'

export default async function StockPage() {
    const data = await getTakaStockBoard()

    if ('error' in data) {
        return (
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-rose-600">Unable to load stock</h1>
                <p className="text-sm text-slate-500">{data.error}</p>
            </div>
        )
    }

    return <TakaStockClient initialData={data} />
}
