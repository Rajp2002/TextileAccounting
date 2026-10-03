import { describe, expect, it } from 'vitest'
import { guardedLinkHref, type GuardClick } from '@/lib/free-leave-guard'

const here = { origin: 'https://app.example.test', pathname: '/free', search: '' }
const click = (overrides: Partial<GuardClick> = {}): GuardClick => ({
  defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
  href: 'https://app.example.test/plans?from=estimator', target: '', download: false, ...overrides,
})

describe('guardedLinkHref', () => {
  it('guards a plain in-app link that leaves this page', () => {
    expect(guardedLinkHref(click(), here)).toBe('/plans?from=estimator')
    expect(guardedLinkHref(click({ href: 'https://app.example.test/free/costings' }), here)).toBe('/free/costings')
  })

  it('lets through links that keep this page mounted or are not navigations', () => {
    // A new tab keeps this page and its inputs.
    expect(guardedLinkHref(click({ target: '_blank' }), here)).toBeNull()
    expect(guardedLinkHref(click({ metaKey: true }), here)).toBeNull()
    expect(guardedLinkHref(click({ ctrlKey: true }), here)).toBeNull()
    expect(guardedLinkHref(click({ shiftKey: true }), here)).toBeNull()
    expect(guardedLinkHref(click({ button: 1 }), here)).toBeNull()
    expect(guardedLinkHref(click({ download: true }), here)).toBeNull()
    expect(guardedLinkHref(click({ defaultPrevented: true }), here)).toBeNull()
    // Same page, including an in-page anchor.
    expect(guardedLinkHref(click({ href: 'https://app.example.test/free#result' }), here)).toBeNull()
  })

  it('guards a full-page navigation to another site too', () => {
    expect(guardedLinkHref(click({ href: 'https://elsewhere.example.test/help' }), here)).toBe('https://elsewhere.example.test/help')
  })

  it('ignores links that are not web navigations', () => {
    expect(guardedLinkHref(click({ href: 'mailto:support@example.test' }), here)).toBeNull()
    expect(guardedLinkHref(click({ href: 'tel:+910000000000' }), here)).toBeNull()
  })
})
