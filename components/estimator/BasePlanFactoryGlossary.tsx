'use client'

import { BookOpen, Sparkles } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="estimator-touch-target group flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-3 min-h-[50px] text-left text-sm font-semibold text-slate-800 shadow-xs transition-all duration-150 hover:border-amber-300 hover:bg-amber-50/40 hover:shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-yarn-orange)] active:scale-[0.99]"
          aria-label={t('base_plan.glossary_title')}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100/80 text-amber-700 transition-colors group-hover:bg-amber-200/80">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-bold text-slate-900 whitespace-nowrap">{t('base_plan.glossary_title')}</span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors group-hover:bg-amber-100 group-hover:text-amber-800">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            <span>11</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shadow-xs border border-amber-200/60">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                {t('base_plan.glossary_title')}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                {t('base_plan.glossary_help')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {terms.map(([key, explanation]) => {
              const { title, definition } = parseTerm(explanation)
              return (
                <div
                  key={key}
                  className="group/card flex flex-col justify-start rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 text-xs transition-all duration-150 hover:border-amber-300/80 hover:bg-amber-50/30 hover:shadow-xs"
                >
                  {title ? (
                    <>
                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>{title}</span>
                      </div>
                      <p className="mt-1 leading-relaxed text-slate-600">
                        {definition}
                      </p>
                    </>
                  ) : (
                    <p className="leading-relaxed text-slate-700">{explanation}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <DialogFooter className="mt-2 border-t border-slate-100 pt-3">
          <DialogClose asChild>
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
