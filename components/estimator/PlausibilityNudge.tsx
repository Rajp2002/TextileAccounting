'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import {
  checkPlausibility,
  formatPlausibleRange,
  formatPlausibleValue,
  plausibilityConfirmationKey,
  type PlausibilityCheck,
  type PlausibilityRule,
} from '@/lib/input-plausibility'

type PlausibilityConfirmations = {
  isConfirmed: (rule: PlausibilityRule, value: number) => boolean
  confirm: (rule: PlausibilityRule, value: number) => void
}

const PlausibilityConfirmationContext = createContext<PlausibilityConfirmations | null>(null)

/**
 * Remembers each "Yes, it's correct" for the page, so the owner answers once
 * per value and the save-time review can count those answers.
 */
export function usePlausibilityConfirmationStore() {
  const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(() => new Set())
  const isConfirmed = useCallback(
    (rule: PlausibilityRule, value: number) => confirmed.has(plausibilityConfirmationKey(rule, value)),
    [confirmed],
  )
  const confirm = useCallback((rule: PlausibilityRule, value: number) => {
    setConfirmed(previous => new Set(previous).add(plausibilityConfirmationKey(rule, value)))
  }, [])
  const reset = useCallback(() => setConfirmed(new Set()), [])
  const store = useMemo(() => ({ isConfirmed, confirm }), [confirm, isConfirmed])
  return { store, reset }
}

export function PlausibilityConfirmationProvider({ store, children }: { store: PlausibilityConfirmations; children: React.ReactNode }) {
  return <PlausibilityConfirmationContext.Provider value={store}>{children}</PlausibilityConfirmationContext.Provider>
}

/**
 * The open question for a field's value: null when the value is usual, blank,
 * or already confirmed. Outside a provider the answer is kept by the field.
 */
export function usePlausibilityQuestion(rule: PlausibilityRule | undefined, value: number | null | undefined) {
  const shared = useContext(PlausibilityConfirmationContext)
  const local = usePlausibilityConfirmationStore().store
  const confirmations = shared ?? local
  const check = rule ? checkPlausibility(rule, value) : null
  const open = check && !confirmations.isConfirmed(check.rule, check.value) ? check : null
  const confirm = useCallback(() => {
    if (open) confirmations.confirm(open.rule, open.value)
  }, [confirmations, open])
  return { check: open, confirm }
}

/**
 * Asks whether an unusual value is right, under the field that holds it, and
 * offers the likely typo fix: "711 D is higher than usual (20–450 D). Is it
 * correct?" with "Change to 71 D" and "Yes, it's correct".
 */
export function PlausibilityNudge({
  id,
  check,
  onUseSuggestion,
  onConfirm,
}: {
  id?: string
  /** In the unit the field shows (see convertPlausibilityCheck). */
  check: PlausibilityCheck
  onUseSuggestion?: (value: number) => void
  onConfirm: () => void
}) {
  const { tx } = useTranslation()
  const value = formatPlausibleValue(check.value, check.range.unit)
  const range = formatPlausibleRange(check.range)
  const { suggestion } = check
  const question = check.direction === 'high'
    ? tx(`${value} is higher than usual (${range}). Is it correct?`)
    : tx(`${value} is lower than usual (${range}). Is it correct?`)

  return (
    <div
      id={id}
      role="status"
      data-plausibility-nudge={check.rule}
      className="mt-1 space-y-1.5 rounded-md border border-[var(--wv-status-warning-border)] bg-[var(--color-warning-amber-soft)] px-2 py-1.5"
    >
      <p className="flex items-start gap-1 text-xs font-semibold leading-tight text-[var(--color-warning-amber)]">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">{question}</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggestion !== null && onUseSuggestion && (
          <button
            type="button"
            onClick={() => onUseSuggestion(suggestion)}
            className="estimator-touch-target rounded-md border border-[var(--color-warning-amber)] bg-[var(--color-canvas-white)] px-2.5 text-xs font-bold text-[var(--color-ink)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-yarn-orange)]"
          >
            {tx(`Change to ${formatPlausibleValue(suggestion, check.range.unit)}`)}
          </button>
        )}
        <button
          type="button"
          onClick={onConfirm}
          className="estimator-touch-target rounded-md border border-[var(--color-hairline)] bg-transparent px-2.5 text-xs font-semibold text-[var(--wv-text-secondary)] hover:bg-[var(--color-canvas-white)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-yarn-orange)]"
        >
          {tx("Yes, it's correct")}
        </button>
      </div>
    </div>
  )
}
