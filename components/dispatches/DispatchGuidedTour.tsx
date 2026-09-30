'use client'

import dynamic from 'next/dynamic'
import { useState, type ReactNode } from 'react'
import ReplicaGuidedTour from '@/components/tours/ReplicaGuidedTour'
import { useTranslation } from '@/lib/i18n/context'
import { dispatchTourSpecs } from '@/lib/dispatch-tour'

const DispatchTourPreview = dynamic(() => import('./DispatchTourPreview'), { ssr: false })
type CopyModule = typeof import('@/lib/i18n/dispatch-tutorial')

export default function DispatchGuidedTour({ userId, orgId, userMetadata, children }: {
    userId: string
    orgId: string
    userMetadata?: Record<string, unknown>
    children: ReactNode
}) {
    const { language, t } = useTranslation()
    const [content, setContent] = useState<CopyModule | null>(null)
    return <ReplicaGuidedTour tourId="dispatch" steps={dispatchTourSpecs} handoffStepId="handoff"
        workspaceClassName="dispatch-workspace-shell mx-auto w-full space-y-5 pb-10 sm:space-y-6"
        railClassName="dispatch-left-rail" railLabel={t('challan.guideTitle')}
        userId={userId} orgId={orgId} userMetadata={userMetadata}
        prepare={async () => { setContent(await import('@/lib/i18n/dispatch-tutorial')) }}
        copy={step => {
            if (!content) throw new Error('Dispatch tour copy must load before launch')
            return content.dispatchStepCopy(language, step, content.dispatchTourControlLabels(t))
        }}
        renderReplica={step => <DispatchTourPreview step={step} />}>
        {children}
    </ReplicaGuidedTour>
}
