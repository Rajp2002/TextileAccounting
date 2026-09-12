import { getYarnStockBoard } from '../yarn-actions'
import YarnStockClient from '../YarnStockClient'

export const dynamic = 'force-dynamic'
export default async function YarnStockPage() {
    const result = await getYarnStockBoard()
    if ('error' in result) throw new Error(result.error)
    return <YarnStockClient initialData={result.data} />
}
