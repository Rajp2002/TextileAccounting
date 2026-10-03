import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FreeUsageCard } from '@/components/estimator/FreeUsageCard'
import { FreeTransactionRecovery } from '@/components/estimator/FreeTransactionRecovery'
import { FreeSavedReceipt } from '@/components/estimator/FreeSavedReceipt'
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
    it('UI-01: 2 of 2 remaining shows both segments filled and "2 / 2 left this month"', () => {
      const html = renderWithLang(
        React.createElement(FreeUsageCard, {
          quota: { limit: 2, remaining: 2, resetsAt: futureDate },
        })
      )

      expect(html).toContain('2 / 2')
      expect(html).toContain('left this month')
      expect(html).toContain('Free costings')
      // Both segments filled (bg-wv-neel-600)
      const filledCount = (html.match(/bg-wv-neel-600/g) || []).length
      expect(filledCount).toBe(2)
      // No exhausted warning
      expect(html).not.toContain('Monthly limit reached')
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
      expect(html).toContain('left this month')
      // Exactly 1 filled segment and 1 track segment
      const filledCount = (html.match(/bg-wv-neel-600/g) || []).length
      const trackCount = (html.match(/bg-wv-cotton-300/g) || []).length
      expect(filledCount).toBe(1)
      expect(trackCount).toBe(1)
      // Still positive state, not exhausted
      expect(html).not.toContain('Monthly limit reached')
      expect(html).toContain('value="1"')
    })

    it('UI-03: 0 of 2 remaining shows 0 filled segments, "Monthly limit reached", reset note, and plans link', () => {
      const html = renderWithLang(
        React.createElement(FreeUsageCard, {
          quota: { limit: 2, remaining: 0, resetsAt: futureDate },
        })
      )

      expect(html).toContain('0 / 2')
      expect(html).toContain('Monthly limit reached')
      expect(html).toContain('View plans →')
      expect(html).toContain('/plans?from=estimator')
      expect(html).toContain('Resets')
      // 0 filled segments, 2 track segments
      const filledCount = (html.match(/bg-wv-neel-600/g) || []).length
      const trackCount = (html.match(/bg-wv-cotton-300/g) || []).length
      expect(filledCount).toBe(0)
      expect(trackCount).toBe(2)
      expect(html).toContain('value="0"')
    })

    it('UI-03c: inside the mounted estimator, plan actions open the comparison in place instead of leaving', () => {
      const html = renderWithLang(
        React.createElement(FreeUsageCard, {
          quota: { limit: 2, remaining: 0, resetsAt: futureDate },
          initialExpanded: true,
          onViewPlans: () => {},
        })
      )

      expect(html).not.toContain('href="/plans')
      expect(html.match(/<button[^>]*data-free-plan-action="compare"[^>]*>/g)).toHaveLength(2)
      expect(html).toContain('View plans →')
    })

    it('UI-03b: at zero, points to saved costings and PDFs that stay available', () => {
      const html = renderWithLang(
        React.createElement(FreeUsageCard, { quota: { limit: 2, remaining: 0, resetsAt: futureDate } })
      )
      expect(html).toContain('Saved costings and PDFs stay available.')
      expect(html).toContain('href="/free/costings"')
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
      expect(html).not.toContain('Monthly limit reached')
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
      expect(html).not.toContain('Monthly limit reached')
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

    it('UI-06b: after a save whose balance refresh failed, shows no number rather than the pre-save balance', () => {
      const html = renderWithLang(
        React.createElement(FreeUsageCard, {
          quota: { limit: 2, remaining: 2, resetsAt: futureDate },
          unverified: true,
          onRefresh: () => {},
        })
      )

      expect(html).toContain('Balance could not be refreshed')
      expect(html).not.toContain('2 / 2')
      expect(html).toContain('Check again')
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

      expect(html).toContain('Your monthly allowance')
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
    const attempt = {
      estimate: {} as never, label: 'Quality A', requestToken: 'token-1', accountId: 'user-a',
      acknowledged: false, possiblyCommitted: true,
    }

    it('TR-01: an uncertain outcome offers the same-request retry and saved history in a new tab, not a balance check', () => {
      const html = renderWithLang(
        React.createElement(FreeTransactionRecovery, {
          transaction: { phase: 'unknown', attempt, code: 'FREE_TEMPORARY_ERROR', retryable: true },
          onRetry: () => {},
        })
      )

      expect(html).toContain('data-testid="free-recovery-pending"')
      expect(html).toContain('Unable to confirm the outcome. Retry safely using the same request.')
      expect(html).toContain('Retry the same calculation')
      const savedLink = html.match(/<a[^>]*href="\/free\/costings"[^>]*>/)?.[0] ?? ''
      expect(savedLink).toContain('target="_blank"')
      expect(html).not.toContain('Check again')
    })

    it('TR-02: review offers correction and explicit confirmation, and says nothing was used', () => {
      const html = renderWithLang(
        React.createElement(FreeTransactionRecovery, {
          transaction: { phase: 'review', attempt: { ...attempt, possiblyCommitted: false }, fields: ['ppi'] },
          reviewMessages: ['PPI is unusual. Confirm the value before saving.'],
        })
      )

      expect(html).toContain('data-testid="free-recovery-warning"')
      expect(html).toContain('Some inputs need review. Check your values, then confirm to calculate.')
      expect(html).toContain('PPI is unusual. Confirm the value before saving.')
      expect(html).toContain('This calculation has not used a costing yet.')
      expect(html).toContain('data-free-recovery-action="correct"')
      expect(html).toContain('I reviewed the inputs; calculate')
    })

    it('TR-03: returns null while editing or on a first send', () => {
      expect(renderWithLang(React.createElement(FreeTransactionRecovery, { transaction: { phase: 'editing' } }))).toBe('')
      expect(renderWithLang(React.createElement(FreeTransactionRecovery, {
        transaction: { phase: 'submitting', attempt: { ...attempt, possiblyCommitted: false } },
      }))).toBe('')
    })

    it('TR-04: a request that can no longer be replayed offers history and an explicit release, never a retry', () => {
      const html = renderWithLang(
        React.createElement(FreeTransactionRecovery, {
          transaction: { phase: 'unknown', attempt, code: 'FREE_REQUEST_EXPIRED', retryable: false },
        })
      )

      expect(html).toContain('This calculation can no longer be checked from this page.')
      expect(html).toContain('If it was saved, it is in Saved costings.')
      expect(html).toContain('data-free-recovery-action="release"')
      expect(html).not.toContain('Retry the same calculation')
    })

    it('TR-06: a quota rejection opens the plan comparison in place when the estimator provides it', () => {
      const html = renderWithLang(
        React.createElement(FreeTransactionRecovery, {
          transaction: { phase: 'rejected', code: 'FREE_QUOTA_EXHAUSTED' },
          onViewPlans: () => {},
        })
      )
      expect(html).not.toContain('href="/plans')
      expect(html).toContain('data-free-plan-action="compare"')
    })

    it('TR-05: recovery controls are at least 44 px tall', () => {
      const html = renderWithLang(
        React.createElement(FreeTransactionRecovery, {
          transaction: { phase: 'review', attempt: { ...attempt, possiblyCommitted: false }, fields: [] },
        })
      )

      expect(html.match(/data-free-recovery-action="(correct|confirm)"/g)).toHaveLength(2)
      for (const button of html.match(/<button[^>]*>/g) ?? []) expect(button).toContain('h-11')
    })
  })

  describe('INTEGRATION: EstimatorClient keeps result, balance and validation truths apart', () => {
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

    it('IN-01: the Free save path runs the shared local preflight before any request', () => {
      const freeBranch = estimator.slice(estimator.indexOf('if (freeMode) {', estimator.indexOf('const handleSaveQuote')), estimator.indexOf('if (saveQuoteLockRef.current || savingQuote) return'))
      expect(freeBranch).toContain('freePreflight(estimatorValidation')
      expect(freeBranch).toContain("preflight.action === 'fix'")
      expect(freeBranch).toContain('requireWarningReview(')
      expect(freeBranch).toContain('freeMeter.submit(preflight.acknowledged)')
    })

    it('IN-02: input staleness never reaches the usage card; only balance freshness does', () => {
      const card = estimator.slice(estimator.indexOf('<FreeUsageCard'), estimator.indexOf('/>', estimator.indexOf('<FreeUsageCard')))
      expect(card).not.toContain('freeMeter.stale')
      expect(card).toContain('stale={Boolean(freeMeter.statusError && freeMeter.status)}')
      expect(card).toContain('unverified={freeMeter.balanceUnverified}')
    })

    it('IN-03: a confirmed save shows its receipt, and edited inputs label the money as the last saved result', () => {
      expect(estimator).toContain('<FreeSavedReceipt')
      expect(estimator).toContain("freeText(language, 'lastSavedResult')")
      expect(estimator).toContain("freeText(language, 'inputsChangedNotRecalculated')")
    })
  })

  describe('RECEIPT: Saved Free costing confirmation', () => {
    const receipt = {
      label: 'Quality A', confirmedAt: '2026-10-03T09:15:00.000Z',
      quota: { used: 1, limit: 2, remaining: 1, periodStart: '2026-09-30T18:30:00.000Z', resetsAt: '2026-10-31T18:30:00.000Z', policyVersion: 2, replayed: false },
    }

    it('RC-01: names the saved costing, the local confirmation time and the one costing used, with a link to history', () => {
      const html = renderWithLang(React.createElement(FreeSavedReceipt, receipt))
      expect(html).toContain('Saved · Quality A')
      expect(html).toContain('Confirmed at')
      expect(html).toContain('1 costing used.')
      expect(html).toContain('href="/free/costings"')
      // The receipt's balance belongs to its own period; the usage card shows the current one.
      expect(html).not.toContain('remaining')
    })

    it('RC-02: a replay of an earlier save says no additional costing was used', () => {
      const html = renderWithLang(React.createElement(FreeSavedReceipt, { ...receipt, quota: { ...receipt.quota, replayed: true } }))
      expect(html).toContain('Already saved. No additional costing was used.')
      expect(html).not.toContain('1 costing used.')
    })
  })

  describe('I18N: 3-Language Completeness (EN, GU, HI)', () => {
    const requiredKeys = [
      'freeCostings',
      'leftThisMonth',
      'monthlyLimitReached',
      'viewPlans',
      'explorePlansArrow',
      'yourMonthlyAllowance',
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
      'balanceUnverified',
      'savedReceipt',
      'confirmedAt',
      'costingUsed',
      'replayNoCharge',
      'lastSavedResult',
      'inputsChangedNotRecalculated',
      'changedSince',
      'rerunUsesCosting',
      'correctInputs',
      'reviewNoCharge',
      'openSavedCostings',
      'unknownBlocked',
      'unknownBlockedNote',
      'releaseAttempt',
      'paidActiveUnknown',
      'retrying',
      'zeroHistory',
      'leaveUnsavedTitle',
      'leaveUnsavedBody',
      'leaveUnresolvedTitle',
      'leaveUnresolvedBody',
      'stayOnPage',
      'leaveAnyway',
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
      expect(guHtml).toContain('માસિક મર્યાદા પૂરી થઈ')
      expect(guHtml).toContain('પ્લાન જુઓ →')

      const hiHtml = renderWithLang(
        React.createElement(FreeUsageCard, {
          quota: { limit: 2, remaining: 0, resetsAt: futureDate },
          initialExpanded: true,
        }),
        'hi'
      )
      expect(hiHtml).toContain('मासिक सीमा पूरी हुई')
      expect(hiHtml).toContain('प्लान देखें →')
    })
  })
})
