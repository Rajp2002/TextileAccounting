import CommercialsClient from './CommercialsClient'
import { getCommercialsData, getCommercialReceivables, getCollectedThisMonth } from './actions'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Commercials | Owner Dashboard',
    description: 'Gross profit, receivables, and payment tracking.',
}

export default async function CommercialsPage() {
    const [commercialsRes, receivablesRes, collectedRes] = await Promise.all([
        getCommercialsData(),
        getCommercialReceivables(),
        getCollectedThisMonth(),
    ])

    if ('error' in commercialsRes) {
        return (
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-rose-600">Unable to load commercials</h1>
                <p className="text-sm text-muted-foreground">{commercialsRes.error}</p>
            </div>
        )
    }

    const receivables = 'error' in receivablesRes ? [] : (receivablesRes.data ?? [])
    const collectedThisMonth = 'error' in collectedRes ? 0 : (collectedRes.data ?? 0)

    return <CommercialsClient initialData={commercialsRes.data} initialReceivables={receivables} collectedThisMonth={collectedThisMonth} />
}

