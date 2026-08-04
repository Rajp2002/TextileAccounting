'use client'

import { useTranslation } from '@/lib/i18n/context'
import { ChevronDown } from 'lucide-react'

export function BasePlanFactoryGlossary() {
  const { t } = useTranslation()

  const terms = [
    ['warp', t('base_plan.glossary.warp')],
    ['weft', t('base_plan.glossary.weft')],
    ['ppi', t('base_plan.glossary.ppi')],
    ['crimp', t('base_plan.glossary.crimp')],
    ['waste', t('base_plan.glossary.waste')],
    ['pick_rate', t('base_plan.glossary.pick_rate')],
    ['costing', t('base_plan.glossary.costing')],
    ['quotation', t('base_plan.glossary.quotation')],
    ['trader', t('base_plan.glossary.trader')],
    ['margin', t('base_plan.glossary.margin')],
    ['gst', t('base_plan.glossary.gst')],
  ] as const

  return (
    <details className="group mx-auto w-full max-w-6xl overflow-hidden rounded-xl border border-slate-200 bg-white/90 text-sm shadow-sm">
      <summary className="estimator-touch-target flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 font-bold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-yarn-orange)] [&::-webkit-details-marker]:hidden">
        <span>{t('base_plan.glossary_title')}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform motion-reduce:transition-none group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-slate-200 px-4 pb-4 pt-3">
        <p className="text-xs leading-relaxed text-slate-500">{t('base_plan.glossary_help')}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {terms.map(([key, explanation]) => (
            <p key={key} className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
              {explanation}
            </p>
          ))}
        </div>
      </div>
    </details>
  )
}
