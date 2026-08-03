'use client'

import { useTranslation } from '@/lib/i18n/context'

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
    <details className="mx-auto w-full max-w-6xl rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm shadow-sm">
      <summary className="cursor-pointer font-bold text-slate-900">{t('base_plan.glossary_title')}</summary>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{t('base_plan.glossary_help')}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {terms.map(([key, explanation]) => (
          <p key={key} className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
            {explanation}
          </p>
        ))}
      </div>
    </details>
  )
}
