'use client'

import { ArrowUpRight, Calendar, CheckCircle2, LifeBuoy, Receipt, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { BILLING_DOCUMENT_POLICY } from '@/lib/billing-document-policy'
import { useTranslation } from '@/lib/i18n/context'
import { freeMobileEntryText } from '@/lib/i18n/free-mobile-entry'
import { planTrustDetails, planTrustLabel } from '@/lib/i18n/plan-trust-tiles'
import { planSelectionText } from '@/lib/i18n/plan-selection'
import Link from 'next/link'
import styles from './plan-selection.module.css'

const topics = ['receipt', 'renewal', 'activation', 'checkout'] as const
const icons = [Receipt, Calendar, CheckCircle2, ShieldCheck]
const summaries = ['receiptSummary', 'renewalSummary', 'activationSummary', 'checkoutSummary'] as const
const shortTitles = ['shortReceipt', 'shortRenewal', 'shortActivation', 'shortCheckout'] as const

export function PlanTrustTiles({ mobileCompact }: { mobileCompact: boolean }) {
  const { language, t } = useTranslation()
  const label = freeMobileEntryText(language, 'billingTerms')
  const items = [
    { title: freeMobileEntryText(language, 'receiptDocument'), description: t('base_plan.billing.receipt_only') },
    { title: freeMobileEntryText(language, 'manualRenewal'), description: freeMobileEntryText(language, 'manualRenewalDescription') },
    { title: freeMobileEntryText(language, 'verifiedActivation'), description: freeMobileEntryText(language, 'verifiedActivationDescription') },
    { title: freeMobileEntryText(language, 'secureCheckout'), description: freeMobileEntryText(language, 'secureCheckoutDescription') },
  ]
  return (
    <section aria-label={label} className={styles.terms + ' mx-auto w-full max-w-6xl border-t border-hairline pt-1'} data-billing-document-state={BILLING_DOCUMENT_POLICY.state} data-mobile-compact={mobileCompact}>
      <h2 className={styles.trustHeading}>{planSelectionText(language, 'trustTitle')}</h2>
      <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_auto] gap-1">
        {items.map((item, index) => {
          const Icon = icons[index]
          return (
            <Dialog key={item.title}>
              <DialogTrigger asChild>
                <button type="button" aria-label={item.title} className="group flex h-full min-h-[44px] flex-col items-center justify-center gap-1 rounded-lg border border-transparent px-1 py-1 text-center transition-colors duration-150 hover:border-hairline hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-deep sm:flex-row sm:gap-2 motion-reduce:transition-none">
                  <Icon className="mt-0.5 size-5 shrink-0 text-subtle" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="hidden text-sm font-semibold text-ink sm:block">{item.title}</span>
                    <span className="block text-sm font-semibold text-ink sm:hidden">{planSelectionText(language, shortTitles[index])}</span>
                    <span className="sr-only">{planSelectionText(language, summaries[index])}</span>
                  </span>
                  <ArrowUpRight className="mt-0.5 hidden size-4 shrink-0 text-subtle sm:block" aria-hidden="true" />
                </button>
              </DialogTrigger>
              <DialogContent mobilePresentation="center" showCloseButton={false} className="gap-6">
                <div className="flex items-center gap-3">
                  <Icon className="size-5 shrink-0 text-subtle" aria-hidden="true" />
                  <DialogTitle>{item.title}</DialogTitle>
                </div>
                <DialogDescription className="text-base leading-relaxed">{item.description}</DialogDescription>
                <ul className="space-y-3 text-sm leading-relaxed text-body">
                  {planTrustDetails(language, topics[index]).map(line => <li key={line} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /><span>{line}</span></li>)}
                </ul>
                <DialogClose asChild><Button size="lg" className="min-h-[44px] justify-self-end">{planTrustLabel(language, 'close')}</Button></DialogClose>
              </DialogContent>
            </Dialog>
          )
        })}
        <Link href="/support" aria-label={planSelectionText(language, 'help')} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium text-subtle underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-deep"><LifeBuoy className="size-5 shrink-0" aria-hidden="true" /><span className="hidden sm:inline">{planSelectionText(language, 'support')}</span></Link>
      </div>
    </section>
  )
}
