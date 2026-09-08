import { getQualityStockBoard } from './actions'
import QualityStockClient from './QualityStockClient'

export const dynamic = 'force-dynamic'

export default async function StockPage() {
    const result = await getQualityStockBoard()
    if ('error' in result) throw new Error(result.error)
    return <QualityStockClient initialData={result.data} />
}
