'use client'

import { Handshake } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import OfferCheckClient from '@/app/(dashboard)/owner/quotes/offer/OfferCheckClient'
import { useTranslation } from '@/lib/i18n/context'
import { offerCheckText } from '@/lib/i18n/offer-check'
import { findOfferCandidate, type OfferCandidate } from '@/lib/offer-check'

/** An offer is a temporary comparison over the library, never a new costing. */
export function OfferCheckDialog({ candidates, loadError, costingId, onClose, returnFocusTo }: {
    candidates: OfferCandidate[]
    loadError: boolean
    costingId: string | null
    onClose: () => void
    returnFocusTo: HTMLElement | null
}) {
    const { language } = useTranslation()
    const copy = offerCheckText[language]
    const initial = findOfferCandidate(candidates, costingId ?? undefined) ?? (candidates.length === 1 ? candidates[0] : null)

    return (
        <Dialog open onOpenChange={open => { if (!open) onClose() }}>
            <DialogContent
                data-offer-dialog
                data-i18n-skip="true"
                lang={language}
                className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-[920px] sm:p-0"
                onOpenAutoFocus={event => {
                    // The price receives focus after the costing loads; otherwise start with Quality.
                    event.preventDefault()
                    const content = event.currentTarget
                    if (content instanceof HTMLElement) content.querySelector<HTMLElement>('[role="combobox"]')?.focus()
                }}
                onCloseAutoFocus={event => {
                    if (returnFocusTo?.isConnected) {
                        event.preventDefault()
                        returnFocusTo.focus({ preventScroll: true })
                    }
                }}
            >
                <DialogHeader className="shrink-0 flex-row items-center gap-4 px-5 pb-5 pt-6 pr-14 sm:px-7 sm:pr-16">
                    <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-saffron-soft text-saffron">
                        <Handshake className="size-6" />
                    </span>
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <DialogTitle className="text-[24px] tracking-[-0.025em] sm:text-[26px]">{copy.title}</DialogTitle>
                        <DialogDescription className="text-[15px] leading-relaxed">{copy.intro}</DialogDescription>
                    </div>
                </DialogHeader>
                <div className="min-h-0 overflow-y-auto overscroll-contain">
                    <OfferCheckClient
                        candidates={candidates}
                        loadError={loadError}
                        initialKey={initial?.key ?? null}
                        initialBase={null}
                        onClose={onClose}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
