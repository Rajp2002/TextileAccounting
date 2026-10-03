'use client'

import { Check, CircleAlert } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { freeText } from '@/lib/i18n/free-tier'
import type { FreeCostingSection } from '@/lib/free-costing-sections'

export function FreeCostingChecklist({ sections, onSelect }: { sections: FreeCostingSection[]; onSelect: (section: FreeCostingSection) => void }) {
  const { language } = useTranslation()
  const incomplete = sections.some(section => section.status === 'incomplete')
  const review = sections.some(section => section.status === 'review')
  return <div className="px-5 py-5" data-testid="free-costing-checklist">
    <div role="status" aria-live="polite" className="mb-4">
      <p className="text-sm font-semibold text-ink">{freeText(language, incomplete ? 'completeSections' : review ? 'reviewSections' : 'readyToCalculate')}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{freeText(language, 'sectionChecklistHint')}</p>
    </div>
    <div className="flex flex-wrap gap-2">
      {sections.map(section => {
        const complete = section.status === 'complete'
        const label = freeText(language, section.label)
        const status = freeText(language, complete ? 'sectionComplete' : section.status === 'review' ? 'sectionReview' : 'sectionIncomplete')
        return <button key={section.id} type="button" data-free-section={section.id} data-status={section.status}
          aria-label={`${label}: ${status}`} onClick={() => onSelect(section)}
          className={`inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-full border px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 ${complete ? 'border-[var(--wv-moss-200)] bg-[var(--wv-moss-50)] text-[var(--wv-moss-700)] hover:bg-[var(--color-factory-green-soft)]' : 'border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] text-[var(--wv-ochre-900)] hover:bg-[var(--color-warning-amber-soft)]'}`}>
          {complete ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          <span>{label}</span>
        </button>
      })}
    </div>
  </div>
}
