import { Suspense } from 'react'
import { getFactoryToday } from './actions'
import { FactoryTodayClient } from './FactoryTodayClient'
import { FactoryTodayLoading } from '@/components/factory-today/factory-today-loading'

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
            fallback={<FactoryTodayLoading />}
        >
            <FactoryTodayContent />
        </Suspense>
    )
}
