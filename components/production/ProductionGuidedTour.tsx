'use client'

import dynamic from 'next/dynamic'
import { useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import ReplicaGuidedTour from '@/components/tours/ReplicaGuidedTour'
import { useTranslation } from '@/lib/i18n/context'
import { productionTourSpecs } from '@/lib/production-tour'

const ProductionSampleWorkspace = dynamic(() => import('./ProductionSampleWorkspace'), { ssr: false })
type CopyModule = typeof import('@/lib/i18n/production-tutorial')

export default function ProductionGuidedTour({ userId, orgId, userMetadata, children }: {
    userId: string
    orgId: string
    userMetadata?: Record<string, unknown>
    children: ReactNode
}) {
    const pathname = usePathname()
    const { language, t } = useTranslation()
    const [content, setContent] = useState<CopyModule | null>(null)
    // GT-12 owns the Daily Sheet tour. Its live subtree remains untouched here.
    if (pathname === '/owner/production/daily-sheet') return <>{children}</>

    return <ReplicaGuidedTour tourId="production" steps={productionTourSpecs} handoffStepId="pd-handoff"
        workspaceClassName=""
        userId={userId} orgId={orgId} userMetadata={userMetadata}
        prepare={async () => { setContent(await import('@/lib/i18n/production-tutorial')) }}
        copy={step => {
            if (!content) throw new Error('Production tour copy must load before launch')
            return content.productionStepCopy(language, step, content.productionTourControlLabels(t))
        }}
        renderReplica={() => <ProductionSampleWorkspace />}>
        {children}
    </ReplicaGuidedTour>
}
