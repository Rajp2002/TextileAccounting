import { describe, expect, it } from 'vitest'
import { freeLeaveReason, freePageSnapshot, guardedLinkHref, type GuardClick } from '@/lib/free-leave-guard'
import { makeFreeEstimate } from '@/lib/free-estimator-defaults'

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

describe('freeLeaveReason', () => {
  const page = { state: makeFreeEstimate(), qualityLabel: 'Quality A', warpInstruction: '', weftInstruction: '' }
  const snapshot = freePageSnapshot(page)
  const base = { guarded: true, unresolved: false, hasUnsavedEdits: true, page: snapshot, savedPage: snapshot }

  it('asks nothing outside Free and the paid estimator it becomes', () => {
    expect(freeLeaveReason({ ...base, guarded: false, unresolved: true })).toBeNull()
  })

  it('puts an unconfirmed request first', () => {
    expect(freeLeaveReason({ ...base, unresolved: true })).toBe('unresolved')
  })

  it('treats a page that still matches the last confirmed save as clean', () => {
    expect(freeLeaveReason(base)).toBeNull()
    expect(freeLeaveReason({ ...base, hasUnsavedEdits: false, page: 'changed' })).toBeNull()
  })

  it('guards edits made before any save', () => {
    expect(freeLeaveReason({ ...base, savedPage: null })).toBe('unsaved')
  })

  it('guards name, row-name and note edits after a save, not only inputs that change the money', () => {
    const changed = (change: Partial<typeof page>) => freeLeaveReason({ ...base, page: freePageSnapshot({ ...page, ...change }) })
    expect(changed({ qualityLabel: 'Quality A, 2nd revision' })).toBe('unsaved')
    expect(changed({ warpInstruction: 'Use the 75D lot from Sachin' })).toBe('unsaved')
    expect(changed({ weftInstruction: '64 Picks, soft twist' })).toBe('unsaved')
    expect(changed({ state: { ...page.state, warpRows: page.state.warpRows.map(row => ({ ...row, label: 'Beam A' })) } })).toBe('unsaved')
  })
})
