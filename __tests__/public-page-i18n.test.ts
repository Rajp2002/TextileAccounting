import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Home from '../app/page'
import Privacy from '../app/privacy/page'
import Terms from '../app/terms/page'
import Refunds from '../app/refund-policy/page'
import Requests from '../app/privacy-request/page'
import Security from '../app/security-incident/page'
import { createPublicPageTranslator, isPublicPagePath, loadPublicPageTranslator } from '../lib/i18n/public-pages'
import hi from '../lib/i18n/public-pages/hi.json'
import gu from '../lib/i18n/public-pages/gu.json'
import { LEGAL_OPERATOR } from '../lib/legal-operator'

// Product names, contact details and engineering notation intentionally stay
// unchanged. Everything else rendered by these pages must have curated copy.
const unchanged = new Set([
  'English', 'Free', 'Lite', 'Base', 'Weavly Free', 'Weavly Lite', 'Weavly Base',
  'Weavly Free:', 'Weavly Lite:', 'Weavly Base:', 'Supabase', 'Vercel', 'Razorpay',
  'Sentry', 'Upstash', 'GST', 'PDF · A4', 'D ×', 'D · +', 'cm', 'cm ×', 'PPI ×',
  '/kg +', '% GST', LEGAL_OPERATOR.contactEmail, LEGAL_OPERATOR.postalAddress,
])

function decode(text: string) {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, code: string) => {
    if (code.startsWith('#x')) return String.fromCodePoint(parseInt(code.slice(2), 16))
    if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)))
    return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' } as Record<string, string>)[code] ?? entity
  }).replace(/\s+/g, ' ').trim()
}

function renderedCopy(html: string) {
  const content = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, '')
  const text = Array.from(content.matchAll(/>([^<]+)</g), (match) => decode(match[1]))
  const attributes = Array.from(content.matchAll(/\b(?:alt|title|aria-label|aria-description|aria-valuetext)="([^"]+)"/g), (match) => decode(match[1]))
  return [...new Set([...text, ...attributes])].filter((value) => /[A-Za-z]/.test(value))
}

describe('public page translations', () => {
  it('limits curated translation to public routes', () => {
    for (const path of ['/', '/privacy', '/terms/', '/refund-policy', '/privacy-request', '/security-incident']) {
      expect(isPublicPagePath(path)).toBe(true)
    }
    expect(isPublicPagePath('/owner')).toBe(false)
    expect(isPublicPagePath('/privacy/unknown')).toBe(false)
    expect(isPublicPagePath('/login')).toBe(false)
  })

  it('has matching Hindi and Gujarati entries and interpolation values', () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(gu).sort())
    for (const copy of [hi, gu]) {
      for (const [source, target] of Object.entries(copy)) {
        expect(target.trim(), source).not.toBe('')
        expect(target.match(/\{\w+\}/g)?.sort() ?? [], source).toEqual(source.match(/\{\w+\}/g)?.sort() ?? [])
      }
    }
    for (const text of Object.values(hi)) expect(text.replaceAll('ગુજરાતી', '')).not.toMatch(/[\u0a80-\u0aff]/)
    for (const text of Object.values(gu)) expect(text.replaceAll('हिंदी', '')).not.toMatch(/[\u0900-\u097f]/)
  })

  for (const [language, copy] of Object.entries({ hi, gu })) {
    const translate = createPublicPageTranslator(copy)
    it.each(Object.entries({ Home, Privacy, Terms, Refunds, Requests, Security }))(
      `covers all rendered %s copy and accessible labels in ${language}`,
      (_name, Page) => {
        const missing = renderedCopy(renderToString(createElement(Page))).filter((source) => (
          !unchanged.has(source)
          && !/^(?:₹[\d,.]+\/kg|[\d,.]+ (?:m(?: × ₹[\d,.]+)?|PPI|p\/pick))$/.test(source)
          && translate(source) === undefined
        ))
        expect(missing).toEqual([])
      },
    )

    it(`preserves changing prices, quantities and service levels in ${language}`, async () => {
      const loaded = await loadPublicPageTranslator(language as 'hi' | 'gu')
      for (const source of [
        '160 rupees per kilogram', '82 picks per inch', '12.5 paise per pick', '19.5 percent',
        '₹12,345 total (GST included)', '₹6,789 total/year (GST included)',
        'Manual from 45 days before expiry', '42 calendar days from receipt',
        'We log the request and aim to acknowledge it within 4 business days.',
        'Our internal target is a substantive response within 28 calendar days of receipt.',
        'Cost is unchanged. Margin moves the price, not the cost: quote ₹27.56 a metre.',
        'Cost up ₹1.34 a metre. Quote the old price on 1,00,000 m and ₹1,34,000 of margin is gone.',
        'Cost down ₹2.15 a metre. That is ₹2,15,000 of room across 1,00,000 m.',
        'Production cost ₹24.10 per metre. Cost down ₹2.15 a metre. That is ₹2,15,000 of room across 1,00,000 m.',
      ]) {
        const target = loaded(source)
        expect(target, source).toBeDefined()
        expect(target, source).not.toBe(source)
        expect(target?.match(/\d+(?:[.,]\d+)*/g)?.sort(), source).toEqual(source.match(/\d+(?:[.,]\d+)*/g)?.sort())
      }
    })

    it(`does not partially translate changed legal clauses in ${language}`, () => {
      expect(translate('New policy wording mentioning Privacy Policy')).toBeUndefined()
    })
  }
})
