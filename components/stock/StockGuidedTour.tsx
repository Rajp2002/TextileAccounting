'use client'

import dynamic from 'next/dynamic'
import { useState, type ReactNode } from 'react'
import ReplicaGuidedTour from '@/components/tours/ReplicaGuidedTour'
import { useTranslation } from '@/lib/i18n/context'
import { fabricStockTourSpecs, yarnStockTourSpecs, type FabricStockTourStep, type YarnStockTourStep } from '@/lib/stock-tour'
import type { StockTourKind } from '@/lib/stock-tour'

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
        steps={kind === 'fabric-stock' ? fabricStockTourSpecs : yarnStockTourSpecs}
        handoffStepId={kind === 'fabric-stock' ? 'fs-handoff' : 'ys-handoff'}
        workspaceClassName="stock-workspace-shell"
        userId={userId} orgId={orgId} userMetadata={userMetadata}
        prepare={async () => { setContent(await import('@/lib/i18n/stock-tutorial')) }}
        copy={step => {
            if (!content) throw new Error('Stock tour copy must load before launch')
            if (kind === 'fabric-stock') return content.fabricStockStepCopy(language, step as FabricStockTourStep, content.fabricStockTourControlLabels(t))
            return content.yarnStockStepCopy(language, step as YarnStockTourStep, content.yarnStockTourControlLabels(language, t))
        }}
        renderReplica={step => <StockSampleWorkspace kind={kind} step={step} />}>
        <div className="stock-workspace-shell">{children}</div>
    </ReplicaGuidedTour>
}
