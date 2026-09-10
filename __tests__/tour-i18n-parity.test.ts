import { describe, it, expect } from 'vitest'
import { tourInvitationCopy } from '../lib/i18n/tour-invitations'
import { tourRegistry, supportedTours } from '../lib/tours/tour-registry'
import type { Language } from '../lib/i18n/context'

describe('Tour Invitation i18n Parity (EN, GU, HI)', () => {
  const languages: Language[] = ['en', 'gu', 'hi']

  it('provides copy for all registered tours across all supported languages', () => {
    for (const lang of languages) {
      const langMap = tourInvitationCopy[lang]
      expect(langMap, `Missing copy table for language: ${lang}`).toBeDefined()
      expect(langMap.takeTour.trim().length, `takeTour empty in ${lang}`).toBeGreaterThan(0)
      expect(langMap.dismiss.trim().length, `dismiss empty in ${lang}`).toBeGreaterThan(0)
      expect(langMap.tour.trim().length, `tour button empty in ${lang}`).toBeGreaterThan(0)
      expect(langMap.tourAriaLabel.trim().length, `tourAriaLabel empty in ${lang}`).toBeGreaterThan(0)

      for (const tourId of supportedTours) {
        const benefit = langMap.benefits[tourId]
        expect(benefit, `Missing benefit copy for tour "${tourId}" in language "${lang}"`).toBeDefined()
        expect(benefit.trim().length, `benefit empty for ${tourId} in ${lang}`).toBeGreaterThan(10)

        const tourName = langMap.tourNames[tourId]
        expect(tourName, `Missing tour name for tour "${tourId}" in language "${lang}"`).toBeDefined()
        expect(tourName.trim().length, `tourName empty for ${tourId} in ${lang}`).toBeGreaterThan(2)
      }
    }
  })

  it('contains valid non-English scripts for Gujarati (GU) and Hindi (HI)', () => {
    // Gujarati Unicode range: \u0A80-\u0AFF
    const gujaratiRegex = /[\u0A80-\u0AFF]/
    // Devanagari Unicode range: \u0900-\u097F
    const devanagariRegex = /[\u0900-\u097F]/

    expect(gujaratiRegex.test(tourInvitationCopy.gu.takeTour)).toBe(true)
    expect(gujaratiRegex.test(tourInvitationCopy.gu.dismiss)).toBe(true)
    expect(gujaratiRegex.test(tourInvitationCopy.gu.tour)).toBe(true)

    expect(devanagariRegex.test(tourInvitationCopy.hi.takeTour)).toBe(true)
    expect(devanagariRegex.test(tourInvitationCopy.hi.dismiss)).toBe(true)
    expect(devanagariRegex.test(tourInvitationCopy.hi.tour)).toBe(true)

    for (const tourId of supportedTours) {
      const guBenefit = tourInvitationCopy.gu.benefits[tourId]
      expect(gujaratiRegex.test(guBenefit), `GU benefit for ${tourId} must contain Gujarati script`).toBe(true)

      const hiBenefit = tourInvitationCopy.hi.benefits[tourId]
      expect(devanagariRegex.test(hiBenefit), `HI benefit for ${tourId} must contain Devanagari script`).toBe(true)
    }
  })

  it('registry specifies halo emphasis strictly for cost-estimate, and static for others', () => {
    expect(tourRegistry['cost-estimate'].emphasis).toBe('halo')
    expect(tourRegistry['rate-book'].emphasis).toBe('static')
    expect(tourRegistry['saved-costings'].emphasis).toBe('static')
  })
})
