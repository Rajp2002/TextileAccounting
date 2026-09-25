'use client'

import { useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronRight, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { railButton, railIcon } from '@/components/ui/rail'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/context'
import { productionTutorialCopy } from '@/lib/i18n/production-tutorial'
import { TourInvitation } from '@/components/tours/TourInvitation'
import ProductionTutorial from '@/components/tours/ProductionTutorial'
import ProductionTourPreview from './ProductionTourPreview'
import { productionTourSteps, productionTourDetailSteps, type ProductionTourStep } from '@/lib/production-tour'

/** Keep the live page mounted so leaving the isolated preview restores all user state. */
export default function ProductionGuidedTour({ userId, orgId, userMetadata, children }: {
    userId: string
    orgId: string
    userMetadata?: Record<string, unknown>
    children: ReactNode
}) {
    const [step, setStep] = useState<ProductionTourStep | null>(null)
    const pathname = usePathname()
    const isDailySheet = pathname === '/owner/production/daily-sheet'
    const { language } = useTranslation()
    const copy = productionTutorialCopy[language]
    const returnFocus = useRef<HTMLButtonElement | null>(null)
    const launcher = useRef<HTMLDivElement>(null)
    const returnScroll = useRef({ x: 0, y: 0 })
    return <>
        {!isDailySheet && <aside className="production-left-rail guided-tour-left-rail space-y-2" aria-label="Production guides and tools">
            <div ref={launcher}>
                <TourInvitation
                    tourId="production"
                    userId={userId}
                    orgId={orgId}
                    userMetadata={userMetadata}
                    align="full"
                    className="w-full"
                    onLaunch={() => {
                        returnFocus.current = launcher.current?.querySelector<HTMLButtonElement>('[data-tour-control="take-tour"], [data-tour-control="quiet-tour"]') ?? null
                        returnScroll.current = { x: window.scrollX, y: window.scrollY }
                        setStep(productionTourSteps[0])
                    }}
                />
                <Button
                    type="button"
                    variant="outline"
                    className={cn(railButton, 'mt-2 h-auto whitespace-normal')}
                    data-tour-control="production-details"
                    onClick={event => {
                        returnFocus.current = event.currentTarget
                        returnScroll.current = { x: window.scrollX, y: window.scrollY }
                        setStep(productionTourDetailSteps[0])
                    }}
                >
                    <span className="flex min-w-0 items-center gap-2.5">
                        <ListChecks className={railIcon} aria-hidden="true" />
                        <span className="min-w-0">{copy.details}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Button>
            </div>
        </aside>}
        <div hidden={step !== null}>{children}</div>
        {step && <>
            <ProductionTourPreview step={step} />
            <ProductionTutorial step={step} onStepChange={setStep} launcher={launcher} returnFocus={returnFocus} returnScroll={returnScroll} userId={userId} />
        </>}
    </>
}
