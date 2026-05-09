import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { getFactoryToday } from './actions'
import { FactoryTodayClient } from './FactoryTodayClient'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Factory Today — Weavly',
    description: "Your factory's live action list for today. Production, stock, dispatches, and payroll — all in one view.",
}

async function FactoryTodayContent() {
    const data = await getFactoryToday()
    return <FactoryTodayClient initialData={data} />
}

export default function FactoryTodayPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-[60vh] items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-saffron/60" />
                        <p className="text-sm text-zinc-500">Loading your factory today…</p>
                    </div>
                </div>
            }
        >
            <FactoryTodayContent />
        </Suspense>
    )
}
