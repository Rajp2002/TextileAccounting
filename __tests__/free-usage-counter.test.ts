import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FreeUsageCard } from '@/components/estimator/FreeUsageCard'
import { FreeTransactionRecovery } from '@/components/estimator/FreeTransactionRecovery'
import { freeText } from '@/lib/i18n/free-tier'
import { I18nContext } from '@/lib/i18n/context'

const root = process.cwd()
const read = (file: string) => readFileSync(join(root, file), 'utf8')

function renderWithLang(ui: React.ReactElement, language: 'en' | 'gu' | 'hi' = 'en') {
  return renderToStaticMarkup(
    React.createElement(
      I18nContext.Provider,
      {
        value: {
          language,
          setLanguage: async () => ({ ok: true as const, language }),
          languageStatus: 'ready' as const,
          pendingLanguage: null,
          languageError: null,
          t: (k: string) => k,
          tx: (s: string) => s,
        },
      },
      ui
    )
  )
}

describe('Premium Free-Plan Usage Counter & Estimator Integration', () => {
  const futureDate = '2026-09-14T00:00:00.000Z'

  describe('UI: Segmented Allowance Presentation & States', () => {
    it('UI-01: 2 of 2 remaining shows both segments filled and "2 / 2 left this week"', () => {
      const html = renderWithLang(
        React.createElement(FreeUsageCard, {
          quota: { limit: 2, remaining: 2, resetsAt: futureDate },
        })
      )

      expect(html).toContain('2 / 2')
      expect(html).toContain('left this week')
      expect(html).toContain('Free costings')
      // Both segments filled (bg-stone-800)
      const filledCount = (html.match(/bg-stone-800/g) || []).length
      expect(filledCount).toBe(2)
      // No exhausted warning
      expect(html).not.toContain('Weekly limit reached')
      // Semantic meter
      expect(html).toContain('value="2"')
      expect(html).toContain('min="0"')
      expect(html).toContain('max="2"')
    })

    it('UI-02: 1 of 2 remaining shows 1 segment filled, 1 neutral, without warning styling', () => {
      const html = renderWithLang(
        React.createElement(FreeUsageCard, {
          quota: { limit: 2, remaining: 1, resetsAt: futureDate },
        })
      )

      expect(html).toContain('1 / 2')
      expect(html).toContain('left this week')
      // Exactly 1 filled segment and 1 track segment
      const filledCount = (html.match(/bg-stone-800/g) || []).length
      const trackCount = (html.match(/bg-stone-200/g) || []).length
      expect(filledCount).toBe(1)
      expect(trackCount).toBe(1)
      // Still positive state, not exhausted
      expect(html).not.toContain('Weekly limit reached')
      expect(html).toContain('value="1"')
    })

    it('UI-03: 0 of 2 remaining shows 0 filled segments, "Weekly limit reached", reset note, and plans link', () => {
      const html = renderWithLang(
        React.createElement(FreeUsageCard, {
          quota: { limit: 2, remaining: 0, resetsAt: futureDate },
        })
      )

      expect(html).toContain('0 / 2')
      expect(html).toContain('Weekly limit reached')
      expect(html).toContain('View plans →')
      expect(html).toContain('/plans?from=estimator')
      expect(html).toContain('Resets')
      // 0 filled segments, 2 track segments
      const filledCount = (html.match(/bg-stone-800/g) || []).length
      const trackCount = (html.match(/bg-stone-200/g) || []).length
      expect(filledCount).toBe(0)
      expect(trackCount).toBe(2)
      expect(html).toContain('value="0"')
    })

    it('UI-04: loading without prior balance shows "Checking usage…" skeleton without flashing false counts', () => {
      const html = renderWithLang(
        React.createElement(FreeUsageCard, {
          loading: true,
          quota: null,
        })
      )

      expect(html).toContain('Checking usage…')
      expect(html).toContain('– / –')
      expect(html).not.toContain('0 / 2')
      expect(html).not.toContain('2 / 2')
      expect(html).not.toContain('Weekly limit reached')
      expect(html).toContain('aria-busy="true"')
    })

    it('UI-05: error without balance shows "Usage unavailable" with retry, never claiming limit reached', () => {
      const html = renderWithLang(
        React.createElement(FreeUsageCard, {
          error: 'FREE_TEMPORARY_ERROR',
          quota: null,
          onRefresh: () => {},
        })
      )

      expect(html).toContain('Usage unavailable')
      expect(html).toContain('Check again')
      expect(html).not.toContain('Weekly limit reached')
    })

    it('UI-06: cached/stale balance with offline or prior state shows "Last confirmed"', () => {
      const html = renderWithLang(
        React.createElement(FreeUsageCard, {
          quota: { limit: 2, remaining: 1, resetsAt: futureDate },
          stale: true,
        })
      )

      expect(html).toContain('1 / 2')
      expect(html).toContain('Last confirmed')
    })

    it('UI-07: pending submission displays "Confirmation pending"', () => {
      const html = renderWithLang(
        React.createElement(FreeUsageCard, {
          quota: { limit: 2, remaining: 1, resetsAt: futureDate },
          isPending: true,
        })
      )

      expect(html).toContain('Confirmation pending')
    })

    it('UI-08: expanded disclosure exposes allowance breakdown, reset timestamp, explanation, and plans link', () => {
      const html = renderWithLang(
        React.createElement(FreeUsageCard, {
          quota: { limit: 2, remaining: 1, resetsAt: futureDate },
          initialExpanded: true,
        })
      )

      expect(html).toContain('Your weekly allowance')
      expect(html).toContain('1 of 2 free costings remaining')
      expect(html).toContain('Each completed fabric costing uses one costing')
      expect(html).toContain('same-request retries do not consume allowance')
      expect(html).toContain('Explore plans →')
      expect(html).toContain('/plans?from=estimator')
      expect(html).toContain('aria-expanded="true"')
    })
  })

  describe('DOCK: Responsive Gutter Positioning & Single Instance', () => {
    it('DOCK-01: docked card sets data-docked="true" and inline fixed styles', () => {
      const dockStyle: React.CSSProperties = {
        position: 'fixed',
        left: '280px',
        bottom: '1.5rem',
        width: '248px',
        zIndex: 25,
      }
      const html = renderWithLang(
        React.createElement(FreeUsageCard, {
          quota: { limit: 2, remaining: 2, resetsAt: futureDate },
          isDocked: true,
          dockStyle,
        })
      )

      expect(html).toContain('data-docked="true"')
      expect(html).toContain('position:fixed')
      expect(html).toContain('left:280px')
      expect(html).toContain('z-index:25')
    })

    it('DOCK-02: non-docked card renders inline with responsive max width', () => {
      const html = renderWithLang(
        React.createElement(FreeUsageCard, {
          quota: { limit: 2, remaining: 2, resetsAt: futureDate },
          isDocked: false,
        })
      )

      expect(html).toContain('data-docked="false"')
      expect(html).toContain('max-w-sm')
      expect(html).not.toContain('position:fixed')
    })

    it('DOCK-03: EstimatorClient.tsx renders exactly ONE instance of FreeUsageCard and uses dynamic gutter dock', () => {
      const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

      // Verifies useGutterDock hook usage
      expect(estimator).toContain('useGutterDock')
      expect(estimator).toContain('isDocked: isFreeUsageDocked')
      expect(estimator).toContain('containerRef: estimatorGutterRef')

      // Verifies ref is attached to the estimator container
      expect(estimator).toContain('ref={estimatorGutterRef}')

      // Exactly ONE FreeUsageCard in EstimatorClient
      const cardMatches = estimator.match(/<FreeUsageCard\b/g)
      expect(cardMatches).toHaveLength(1)

      // Bulky FreeMeterPanel has been removed from JSX
      expect(estimator).not.toContain('<FreeMeterPanel')
    })
  })

  describe('RECOVERY: Free Transaction Recovery Banner', () => {
    it('TR-01: pending transaction displays recovery banner with retry and check again actions', () => {
      const html = renderWithLang(
        React.createElement(FreeTransactionRecovery, {
          pending: true,
          onSubmit: () => {},
          onRefresh: () => {},
        })
      )

      expect(html).toContain('data-testid="free-recovery-pending"')
      expect(html).toContain('Unable to confirm the outcome. Retry safely using the same request.')
      expect(html).toContain('Retry the same calculation')
      expect(html).toContain('Check again')
    })

    it('TR-02: warning state displays review confirmation banner with confirm button', () => {
      const html = renderWithLang(
        React.createElement(FreeTransactionRecovery, {
          warning: true,
          onSubmit: () => {},
        })
      )

      expect(html).toContain('data-testid="free-recovery-warning"')
      expect(html).toContain('Some inputs need review. Check your values, then confirm to calculate.')
      expect(html).toContain('I reviewed the inputs; calculate')
    })

    it('TR-03: returns null when no pending, warning, or error is active', () => {
      const html = renderWithLang(
        React.createElement(FreeTransactionRecovery, {
          pending: false,
          warning: false,
          error: null,
        })
      )

      expect(html).toBe('')
    })
  })

  describe('I18N: 3-Language Completeness (EN, GU, HI)', () => {
    const requiredKeys = [
      'freeCostings',
      'leftThisWeek',
      'weeklyLimitReached',
      'viewPlans',
      'explorePlansArrow',
      'yourWeeklyAllowance',
      'costingConsumptionExplanation',
      'checkingUsage',
      'confirmingCosting',
      'confirmationPending',
      'usageUnavailable',
      'lastConfirmed',
      'refreshingAllowance',
      'offlineStale',
      'remainingOfLimit',
      'toggleDetails',
      'reset',
    ] as const

    for (const lang of ['en', 'gu', 'hi'] as const) {
      it(`provides non-empty translations for all required counter keys in ${lang}`, () => {
        for (const key of requiredKeys) {
          const text = freeText(lang, key, { remaining: 1, limit: 2, date: '15 Sep' })
          expect(text.trim().length).toBeGreaterThan(0)
          if (lang === 'gu' && !key.includes('reset') && !key.includes('freeCostings')) {
            expect(text).toMatch(/\p{Script=Gujarati}/u)
          }
          if (lang === 'hi' && !key.includes('reset') && !key.includes('freeCostings')) {
            expect(text).toMatch(/\p{Script=Devanagari}/u)
          }
        }
      })
    }

    it('renders FreeUsageCard cleanly in Gujarati and Hindi without throwing', () => {
      const guHtml = renderWithLang(
        React.createElement(FreeUsageCard, {
          quota: { limit: 2, remaining: 0, resetsAt: futureDate },
          initialExpanded: true,
        }),
        'gu'
      )
      expect(guHtml).toContain('સાપ્તાહિક મર્યાદા પૂરી થઈ')
      expect(guHtml).toContain('પ્લાન જુઓ →')

      const hiHtml = renderWithLang(
        React.createElement(FreeUsageCard, {
          quota: { limit: 2, remaining: 0, resetsAt: futureDate },
          initialExpanded: true,
        }),
        'hi'
      )
      expect(hiHtml).toContain('साप्ताहिक सीमा पूरी हुई')
      expect(hiHtml).toContain('प्लान देखें →')
    })
  })
})
