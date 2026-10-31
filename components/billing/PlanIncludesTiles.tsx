'use client'

import { useState } from 'react'
import { Calculator, Factory, FileText, Layers, Play, Tag, Truck, Users, type LucideIcon } from 'lucide-react'
import { PlanPreviewModal } from '@/components/plans/PlanPreviewModal'
import type { PurchasablePlanTier } from '@/lib/billing-constants'
import type { UpgradeFeature } from '@/lib/upgrade-wall'
import { cn } from '@/lib/utils'

interface IncludedItem {
  icon: LucideIcon
  title: string
  text: string
  /** The feature demo the tile opens. A tile without one is plain. */
  demo?: UpgradeFeature
}

/** What each plan gives the owner, in the words the plan chooser uses. */
const PLAN_INCLUDES: Record<PurchasablePlanTier, readonly IncludedItem[]> = {
  lite: [
    { icon: Calculator, title: 'Unlimited costings', text: 'Cost any fabric, as often as you need.', demo: 'estimator' },
    { icon: Layers, title: 'Saved qualities', text: 'Reuse a fabric construction for the next enquiry.', demo: 'qualities' },
    { icon: Tag, title: 'Yarn Rate Book', text: 'Keep yarn prices current across every costing.', demo: 'rates' },
    { icon: FileText, title: 'Saved Costings and PDF export', text: 'Reopen, compare and share costings as PDF.', demo: 'costings' },
  ],
  base: [
    { icon: Calculator, title: 'Everything in Lite', text: 'The complete costing desk.' },
    { icon: Factory, title: 'Production and looms', text: 'Daily metres by quality, loom and shift.', demo: 'production' },
    { icon: Users, title: 'Workers and payroll', text: 'Piece-rate and fixed-salary pay cycles.', demo: 'payroll' },
    { icon: Truck, title: 'Fabric stock and challans', text: 'Godown stock and dispatch challans.' },
  ],
}

const tileBase = 'flex min-h-[112px] items-center gap-4 rounded-xl border border-hairline bg-surface p-5 sm:gap-5 sm:p-6'

/** The plan's feature tiles, two by two. A tile with a demo lifts on hover and opens that feature's video in a modal. */
export function PlanIncludesTiles({ tier }: { tier: PurchasablePlanTier }) {
  const [feature, setFeature] = useState<UpgradeFeature | null>(null)
  const [trigger, setTrigger] = useState<HTMLElement | null>(null)

  return (
    <>
      <ul className="mt-3 grid flex-1 auto-rows-fr gap-3 sm:grid-cols-2 sm:gap-4">
        {PLAN_INCLUDES[tier].map(({ icon: Icon, title, text, demo }) => {
          const content = (
            <>
              <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl bg-saffron-soft text-saffron-deep', demo && 'transition-[transform,background-color,color] duration-300 ease-out group-hover:scale-110 group-hover:bg-white/10 group-hover:text-[var(--wv-text-brand-on-inverse)] motion-reduce:transition-none motion-reduce:group-hover:scale-100')}>
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-base font-semibold text-ink sm:text-lg', demo && 'transition-colors duration-300 group-hover:text-surface motion-reduce:transition-none')}>{title}</span>
                <span className={cn('mt-1 block text-sm leading-relaxed text-body sm:text-[15px]', demo && 'transition-colors duration-300 group-hover:text-surface/80 motion-reduce:transition-none')}>{text}</span>
              </span>
              {demo && (
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-surface opacity-0 transition-[opacity,background-color,color] duration-300 group-hover:bg-[var(--wv-action-accent)] group-hover:text-ink group-hover:opacity-100 group-focus-visible:opacity-100 max-md:opacity-100 motion-reduce:transition-none">
                  <Play className="size-4 translate-x-px fill-current" />
                </span>
              )}
            </>
          )
          return (
            <li key={title} className="flex">
              {demo ? (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-label={`Watch the ${title} demo`}
                  onClick={event => { setTrigger(event.currentTarget); setFeature(demo) }}
                  className={cn(
                    tileBase,
                    'group relative w-full cursor-pointer text-left shadow-sm transition-[transform,box-shadow,border-color,background-color] duration-300 ease-out',
                    'hover:z-10 hover:-translate-y-1.5 hover:scale-[1.02] hover:border-ink hover:bg-ink hover:shadow-[0_20px_36px_-14px_rgba(22,33,62,0.55)]',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-deep active:translate-y-0 active:scale-100 active:shadow-sm',
                    'motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100',
                  )}
                >
                  {content}
                </button>
              ) : (
                <div className={cn(tileBase, 'w-full shadow-xs')}>{content}</div>
              )}
            </li>
          )
        })}
      </ul>
      <PlanPreviewModal feature={feature} planTier={tier} onClose={() => setFeature(null)} returnFocusElement={trigger} />
    </>
  )
}
