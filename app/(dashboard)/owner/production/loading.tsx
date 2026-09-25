'use client'

import { usePathname } from 'next/navigation'
import { BaseWorkspaceLoading } from '@/components/production/base-workspace-loading'

export default function Loading() {
    const pathname = usePathname()
    const isDailySheet = pathname?.startsWith('/owner/production/daily-sheet')

    return <BaseWorkspaceLoading
        route={isDailySheet ? '/owner/production/daily-sheet' : '/owner/production'}
        title={isDailySheet ? 'Daily sheet' : 'Production'}
        summaryCards={isDailySheet ? 0 : 2}
    />
}
