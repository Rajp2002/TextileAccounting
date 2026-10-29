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
  /** Soft pastel chip behind the icon, matching the estimator's section tiles. */
  tone: string
}

/**
 * Billing terms as four tiles under the plan cards. Each tile lifts on hover (`ui-tile-lift`)
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
      tone: 'bg-[#DDEBFF] text-[#2C5FAE]',
    },
    {
      topic: 'renewal',
      icon: Calendar,
      title: freeMobileEntryText(language, 'manualRenewal'),
      summary: freeMobileEntryText(language, 'manualRenewalDescription'),
      tone: 'bg-[#ECE7FF] text-[#5B45B0]',
    },
    {
      topic: 'activation',
      icon: CheckCircle2,
      title: freeMobileEntryText(language, 'verifiedActivation'),
      summary: freeMobileEntryText(language, 'verifiedActivationDescription'),
      tone: 'bg-[#FFE1EC] text-[#AE3566]',
    },
    {
      topic: 'checkout',
      icon: ShieldCheck,
      title: freeMobileEntryText(language, 'secureCheckout'),
      summary: freeMobileEntryText(language, 'secureCheckoutDescription'),
      tone: 'bg-[#FFF1C7] text-[#8A6100]',
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
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
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
              'ui-tile-lift flex min-h-[44px] w-full items-start gap-3 rounded-xl border border-hairline bg-surface p-4 text-left shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron',
              mobileCompact && 'max-md:p-3',
            )}
          >
            <span data-tile-icon className={cn('grid size-10 shrink-0 place-items-center rounded-lg', tile.tone)}>
              <Icon className="h-5 w-5" aria-hidden={true} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink">{tile.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-subtle">{tile.summary}</span>
              <span className="mt-2 inline-flex items-center gap-0.5 text-xs font-semibold text-ink">
                {planTrustLabel(language, 'learnMore')}
                <ChevronRight data-tile-arrow className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </span>
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
