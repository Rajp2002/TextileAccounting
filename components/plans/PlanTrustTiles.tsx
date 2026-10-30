'use client'

import { useRef, useState, type ComponentType, type MouseEvent } from 'react'
import { Calendar, CheckCircle2, ChevronRight, Receipt, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BILLING_DOCUMENT_POLICY } from '@/lib/billing-document-policy'
import { freeMobileEntryText } from '@/lib/i18n/free-mobile-entry'
import { planTrustDetails, planTrustLabel, type PlanTrustTopic } from '@/lib/i18n/plan-trust-tiles'
import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

interface TrustTile {
  topic: PlanTrustTopic
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  title: string
  summary: string
  /**
   * The tile's colour with brand ink text; also used for the icon chip in its dialog. The four
   * hues share one dusty, mid-light recipe pulled toward the brand: saffron for checkout and a
   * Neel periwinkle for renewal, with teal and rose alongside.
   */
  tone: string
}

/**
 * Billing terms as four colour-coded tiles that show only their title; the summary and full
 * explanation live in the dialog each one opens. On desktop they are pinned to the bottom of the viewport with only
 * their top half showing, like cards tucked into a pocket; hovering or focusing one slides it up
 * (`plan-trust-peek`). Smaller screens keep them in the page flow under the plan cards. Each tile lifts on hover (`ui-tile-lift`)
 * and opens a dialog with the full explanation, so the short line never has to carry the whole
 * policy. The dialog keeps the shared modal spring but grows out of the tile that opened it.
 */
export function PlanTrustTiles({ mobileCompact }: { mobileCompact: boolean }) {
  const { language, t } = useTranslation()
  const [open, setOpen] = useState(false)
  // Kept after closing so the dialog still has content while its exit animation plays.
  const [topic, setTopic] = useState<PlanTrustTopic>('receipt')
  // The tile that opened the dialog: the spring grows out of it and focus returns to it.
  const openerTile = useRef<HTMLButtonElement | null>(null)
  const tileRect = useRef<DOMRect | null>(null)

  const tiles: TrustTile[] = [
    {
      topic: 'receipt',
      icon: Receipt,
      title: freeMobileEntryText(language, 'receiptDocument'),
      summary: t('base_plan.billing.receipt_only'),
      tone: 'bg-[#5FAEA8] text-ink',
    },
    {
      topic: 'renewal',
      icon: Calendar,
      title: freeMobileEntryText(language, 'manualRenewal'),
      summary: freeMobileEntryText(language, 'manualRenewalDescription'),
      tone: 'bg-[#8F9DD3] text-ink',
    },
    {
      topic: 'activation',
      icon: CheckCircle2,
      title: freeMobileEntryText(language, 'verifiedActivation'),
      summary: freeMobileEntryText(language, 'verifiedActivationDescription'),
      tone: 'bg-[#E4909E] text-ink',
    },
    {
      topic: 'checkout',
      icon: ShieldCheck,
      title: freeMobileEntryText(language, 'secureCheckout'),
      summary: freeMobileEntryText(language, 'secureCheckoutDescription'),
      tone: 'bg-[#F2A766] text-ink',
    },
  ]

  const active = tiles.find(tile => tile.topic === topic) ?? tiles[0]

  const openTile = (event: MouseEvent<HTMLButtonElement>, next: PlanTrustTopic) => {
    openerTile.current = event.currentTarget
    tileRect.current = event.currentTarget.getBoundingClientRect()
    setTopic(next)
    setOpen(true)
  }

  // Point the spring's transform-origin at the tile's centre before the first frame, so the
  // dialog scales up out of the tile and shrinks back towards it. Phones keep the bottom sheet.
  const growFromTile = (node: HTMLDivElement | null) => {
    const tile = tileRect.current
    if (!node || !tile || window.matchMedia('(max-width: 639.98px)').matches) return
    const left = (window.innerWidth - node.offsetWidth) / 2
    const top = (window.innerHeight - node.offsetHeight) / 2
    node.style.transformOrigin = `${tile.left + tile.width / 2 - left}px ${tile.top + tile.height / 2 - top}px`
  }

  return (
    <section
      aria-label={freeMobileEntryText(language, 'billingTerms')}
      // Desktop: fixed-width tiles packed close together and centred, so the spare width sits at the
      // row's two ends rather than between the tiles.
      className="plan-trust-peek-row grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,260px))] lg:justify-center lg:gap-5"
      data-billing-document-state={BILLING_DOCUMENT_POLICY.state}
    >
      {tiles.map(tile => {
        const Icon = tile.icon
        return (
          <button
            key={tile.topic}
            type="button"
            onClick={event => openTile(event, tile.topic)}
            aria-haspopup="dialog"
            className={cn(
              'ui-tile-lift plan-trust-peek flex min-h-[44px] w-full items-start gap-3 rounded-xl border-[1.5px] border-ink p-3 text-left shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron lg:min-h-[112px] lg:p-4',
              tile.tone,
              mobileCompact && 'max-md:py-2.5',
            )}
          >
            <span data-tile-icon className={'grid size-8 shrink-0 place-items-center rounded-lg bg-white/40'}>
              <Icon className="h-4 w-4" aria-hidden={true} />
            </span>
            <span className="flex min-h-8 min-w-0 flex-1 items-center text-sm font-bold">{tile.title}</span>
            <ChevronRight data-tile-arrow className="mt-2 h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
        )
      })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          ref={growFromTile}
          // Radix returns focus to a DialogTrigger, and these tiles open the dialog without one.
          onCloseAutoFocus={event => {
            event.preventDefault()
            openerTile.current?.focus()
          }}
          // Grow from a smaller, untilted start so the dialog reads as the tile opening up.
          className="[--modal-enter-rotate:0deg] [--modal-enter-scale:0.25] [--modal-exit-scale:0.5] sm:max-w-md"
        >
          <DialogHeader>
            <span className={cn('grid size-11 place-items-center rounded-xl', active.tone)}>
              <active.icon className="h-5 w-5" aria-hidden={true} />
            </span>
            <DialogTitle>{active.title}</DialogTitle>
            <DialogDescription className="text-body">{active.summary}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-3 text-sm leading-relaxed text-body">
            {planTrustDetails(language, active.topic).map((line, index) => (
              // Each point settles in just after the spring lands.
              <li key={line} className="ui-content-swap flex items-start gap-2.5" style={{ animationDelay: `${140 + index * 60}ms` }}>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" size="lg" className="w-full sm:w-auto" onClick={() => setOpen(false)}>
              {planTrustLabel(language, 'close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
