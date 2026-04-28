import LedgerClient from './LedgerClient'
import { getLedgerData } from './actions'

export const metadata = {
    title: 'Party Ledger | Owner Dashboard',
    description: 'Track party receivables, bills, payments, claims, and overdue credit.',
}

export default async function LedgerPage() {
    const result = await getLedgerData()

    if ('error' in result) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-red-500">Error loading party ledger</h1>
                <p className="text-muted-foreground">{result.error}</p>
            </div>
        )
    }

    return <LedgerClient initialData={result.data} />
}
