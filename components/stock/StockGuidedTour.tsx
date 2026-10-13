'use client'

import dynamic from 'next/dynamic'
import { useState, type ReactNode } from 'react'
import ReplicaGuidedTour from '@/components/tours/ReplicaGuidedTour'
import { useTranslation } from '@/lib/i18n/context'
import { fabricStockTourSpecs, type FabricStockTourStep, type StockTourKind } from '@/lib/stock-tour'

const StockSampleWorkspace = dynamic(() => import('./StockSampleWorkspace'), { ssr: false })
type CopyModule = typeof import('@/lib/i18n/stock-tutorial')

export default function StockGuidedTour({ kind, userId, orgId, userMetadata, children }: {
    kind: StockTourKind
    userId: string
    orgId: string
    userMetadata?: Record<string, unknown>
    children: ReactNode
}) {
    const { language, t } = useTranslation()
    const [content, setContent] = useState<CopyModule | null>(null)
    return <ReplicaGuidedTour tourId={kind}
        steps={fabricStockTourSpecs}
        handoffStepId="fs-handoff"
        workspaceClassName="stock-workspace-shell"
        userId={userId} orgId={orgId} userMetadata={userMetadata}
        prepare={async () => { setContent(await import('@/lib/i18n/stock-tutorial')) }}
        copy={step => {
            if (!content) throw new Error('Stock tour copy must load before launch')
            return content.fabricStockStepCopy(language, step as FabricStockTourStep, content.fabricStockTourControlLabels(t))
        }}
        renderReplica={step => <StockSampleWorkspace step={step as FabricStockTourStep} />}>
        <div className="stock-workspace-shell">{children}</div>
    </ReplicaGuidedTour>
}
