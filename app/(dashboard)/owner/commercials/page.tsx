import CommercialsClient from './CommercialsClient'
import { getCommercialsData } from './actions'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Commercials | Owner Dashboard',
    description: 'Read-only gross profit from invoices, expected orders, direct market sales, and godown stock sales.',
}

export default async function CommercialsPage() {
    const result = await getCommercialsData()

    if ('error' in result) {
        return (
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-rose-600">Unable to load commercials</h1>
                <p className="text-sm text-muted-foreground">{result.error}</p>
            </div>
        )
    }

    return <CommercialsClient initialData={result.data} />
}
