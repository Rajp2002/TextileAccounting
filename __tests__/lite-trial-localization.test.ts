import { describe, expect, it } from 'vitest'
import { liteTrialPhrases, liteTrialText } from '../lib/i18n/lite-trial'

// Tuple order is [English, Gujarati, Hindi], the same as lib/i18n/free-mobile-entry.ts.
const EN = 0
const GU = 1
const HI = 2

const keys = Object.keys(liteTrialPhrases) as (keyof typeof liteTrialPhrases)[]

function placeholders(text: string) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
}

describe('Lite trial localization', () => {
  it('defines exactly the twelve trial copy keys', () => {
    expect([...keys].sort()).toEqual([
      'startTrial',
      'trialPayNow',
      'trialDisclosure',
      'trialNotAvailable',
      'trialBannerDays',
      'trialBannerOneDay',
      'trialBannerLastDay',
      'trialSubscribe',
      'trialEndsOn',
      'trialEndedTitle',
      'trialEndedBody',
      'trialDismiss',
    ].sort())
  })

  it('keeps the English copy from the brief word for word', () => {
    expect(liteTrialPhrases.startTrial[EN]).toBe('Start 3-month free trial')
    expect(liteTrialPhrases.trialPayNow[EN]).toBe('Or pay now: ₹2,999 for the first year')
    expect(liteTrialPhrases.trialDisclosure[EN]).toBe(
      '90 days of Lite free, no payment needed. After that, pay ₹2,999 for the first year (incl. GST) to stay on Lite, or continue on Free.',
    )
    expect(liteTrialPhrases.trialNotAvailable[EN]).toBe('Your free trial is not available for this account.')
    expect(liteTrialPhrases.trialBannerDays[EN]).toBe('Lite trial: {days} days left')
    expect(liteTrialPhrases.trialBannerOneDay[EN]).toBe('Lite trial: 1 day left')
    expect(liteTrialPhrases.trialBannerLastDay[EN]).toBe('Lite trial ends today')
    expect(liteTrialPhrases.trialSubscribe[EN]).toBe('Subscribe to keep Lite')
    expect(liteTrialPhrases.trialEndsOn[EN]).toBe('Free trial ends {date}')
    expect(liteTrialPhrases.trialEndedTitle[EN]).toBe('Your Lite trial has ended')
    expect(liteTrialPhrases.trialEndedBody[EN]).toBe(
      'You are now on Free. Subscribe to Lite to get your saved qualities and rate book back.',
    )
    expect(liteTrialPhrases.trialDismiss[EN]).toBe('Dismiss')
  })

  it('has a non-empty English, Gujarati and Hindi entry for every key', () => {
    for (const key of keys) {
      for (const index of [EN, GU, HI]) {
        expect(liteTrialPhrases[key][index].trim(), `${key} [${index}]`).not.toBe('')
      }
    }
  })

  it('keeps the {days} and {date} placeholders in Gujarati and Hindi wherever English has them', () => {
    for (const key of keys) {
      const english = placeholders(liteTrialPhrases[key][EN])
      expect(placeholders(liteTrialPhrases[key][GU]), `${key} gu`).toEqual(english)
      expect(placeholders(liteTrialPhrases[key][HI]), `${key} hi`).toEqual(english)
    }
    expect(placeholders(liteTrialPhrases.trialBannerDays[GU])).toEqual(['days'])
    expect(placeholders(liteTrialPhrases.trialBannerDays[HI])).toEqual(['days'])
    expect(placeholders(liteTrialPhrases.trialEndsOn[GU])).toEqual(['date'])
    expect(placeholders(liteTrialPhrases.trialEndsOn[HI])).toEqual(['date'])
  })

  it('keeps the brand words and the first-year price as written in Gujarati and Hindi', () => {
    for (const key of ['trialPayNow', 'trialDisclosure'] as const) {
      for (const index of [GU, HI]) {
        expect(liteTrialPhrases[key][index], `${key} ${index}`).toContain('₹2,999')
      }
    }
    for (const index of [GU, HI]) {
      expect(liteTrialPhrases.trialDisclosure[index], `trialDisclosure ${index}`).toContain('Lite')
      expect(liteTrialPhrases.trialDisclosure[index], `trialDisclosure ${index}`).toContain('Free')
    }
  })

  it('gives the last day its own copy in every language, with no count placeholder', () => {
    expect(liteTrialPhrases.trialBannerOneDay[GU]).toBe('Lite ટ્રાયલ: 1 દિવસ બાકી')
    expect(liteTrialPhrases.trialBannerOneDay[HI]).toBe('Lite ट्रायल: 1 दिन बाकी')
    expect(liteTrialText('en', 'trialBannerOneDay')).toBe('Lite trial: 1 day left')
    expect(liteTrialText('gu', 'trialBannerOneDay')).toBe('Lite ટ્રાયલ: 1 દિવસ બાકી')
    expect(liteTrialText('hi', 'trialBannerOneDay')).toBe('Lite ट्रायल: 1 दिन बाकी')
  })

  it('selects the language tuple by language and fills placeholders', () => {
    expect(liteTrialText('en', 'startTrial')).toBe(liteTrialPhrases.startTrial[EN])
    expect(liteTrialText('gu', 'startTrial')).toBe(liteTrialPhrases.startTrial[GU])
    expect(liteTrialText('hi', 'startTrial')).toBe(liteTrialPhrases.startTrial[HI])

    expect(liteTrialText('en', 'trialBannerDays', { days: 12 })).toBe('Lite trial: 12 days left')
    expect(liteTrialText('hi', 'trialBannerDays', { days: 12 })).toBe(liteTrialPhrases.trialBannerDays[HI].replace('{days}', '12'))
    expect(liteTrialText('gu', 'trialEndsOn', { date: '15 Nov 2026' })).toBe(
      liteTrialPhrases.trialEndsOn[GU].replace('{date}', '15 Nov 2026'),
    )
    for (const language of ['en', 'gu', 'hi'] as const) {
      expect(liteTrialText(language, 'trialBannerDays', { days: 3 })).not.toMatch(/\{\w+\}/)
      expect(liteTrialText(language, 'trialEndsOn', { date: '1 Dec 2026' })).not.toMatch(/\{\w+\}/)
    }
  })
})
