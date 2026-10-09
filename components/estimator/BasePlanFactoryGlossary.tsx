'use client'

import { BookOpen } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import type { GuideTopic } from '@/components/tours/TourInvitation'

function parseTerm(explanation: string) {
  const parts = explanation.split(' — ')
  if (parts.length >= 2) {
    return {
      title: parts[0].trim(),
      definition: parts.slice(1).join(' — ').trim(),
    }
  }
  return {
    title: '',
    definition: explanation,
  }
}

export function FactoryGlossaryContent() {
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
    <div className="space-y-3">
      <p className="text-xs text-subtle">{t('base_plan.glossary_help')}</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {terms.map(([key, explanation]) => {
          const { title, definition } = parseTerm(explanation)
          return (
            <div
              key={key}
              className="flex flex-col justify-start rounded-xl border border-wv-border-default/80 bg-canvas/60 p-3 text-xs"
            >
              {title ? (
                <>
                  <div className="flex items-center gap-1.5 font-bold text-ink">
                    <span className="h-1.5 w-1.5 rounded-full bg-wv-neel-600 shrink-0" />
                    <span>{title}</span>
                  </div>
                  <p className="mt-1 leading-relaxed text-body">
                    {definition}
                  </p>
                </>
              ) : (
                <p className="leading-relaxed text-body">{explanation}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** The factory glossary as a Guide topic. */
export function useFactoryGlossaryTopic(): GuideTopic {
  const { t } = useTranslation()
  return { id: 'factory-glossary', icon: BookOpen, title: t('base_plan.glossary_title'), count: 11, content: <FactoryGlossaryContent /> }
}
