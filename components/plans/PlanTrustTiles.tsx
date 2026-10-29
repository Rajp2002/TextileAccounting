'use client'

import { useState, type ComponentType } from 'react'
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
 * Billing terms as four tiles under the plan cards. Each tile lifts on hover and opens a
 * dialog with the full explanation, so the short line never has to carry the whole policy.
 */
export function PlanTrustTiles({ mobileCompact }: { mobileCompact: boolean }) {
  const { language, t } = useTranslation()
  const [openTopic, setOpenTopic] = useState<PlanTrustTopic | null>(null)

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

  const active = tiles.find(tile => tile.topic === openTopic) ?? null

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
            onClick={() => setOpenTopic(tile.topic)}
            aria-haspopup="dialog"
            className={cn(
              'group flex min-h-[44px] w-full items-start gap-3 rounded-xl border border-hairline bg-surface p-4 text-left shadow-xs transition-[translate,box-shadow,border-color] duration-200 ease-out hover:-translate-y-1 hover:border-hairline-strong hover:shadow-md focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron motion-reduce:transition-none motion-reduce:hover:translate-y-0',
              mobileCompact && 'max-md:p-3',
            )}
          >
            <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', tile.tone)}>
              <Icon className="h-5 w-5" aria-hidden={true} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink">{tile.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-subtle">{tile.summary}</span>
              <span className="mt-2 inline-flex items-center gap-0.5 text-xs font-semibold text-ink">
                {planTrustLabel(language, 'learnMore')}
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </span>
          </button>
        )
      })}

      <Dialog open={active !== null} onOpenChange={open => { if (!open) setOpenTopic(null) }}>
        {active && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <span className={cn('grid size-11 place-items-center rounded-xl', active.tone)}>
                <active.icon className="h-5 w-5" aria-hidden={true} />
              </span>
              <DialogTitle>{active.title}</DialogTitle>
              <DialogDescription className="text-body">{active.summary}</DialogDescription>
            </DialogHeader>
            <ul className="space-y-3 text-sm leading-relaxed text-body">
              {planTrustDetails(language, active.topic).map(line => (
                <li key={line} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button type="button" size="lg" className="w-full sm:w-auto" onClick={() => setOpenTopic(null)}>
                {planTrustLabel(language, 'close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </section>
  )
}
