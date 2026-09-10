import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Tour No-Autostart Verification', () => {
  const costEstimateTutorialPath = path.resolve(__dirname, '../components/estimator/CostEstimateTutorial.tsx')
  const rateBookTutorialPath = path.resolve(__dirname, '../components/rates/RateBookTutorial.tsx')
  const savedCostingsTutorialPath = path.resolve(__dirname, '../components/estimator/SavedCostingsTutorial.tsx')

  const costEstimateTutorialSource = fs.readFileSync(costEstimateTutorialPath, 'utf-8')
  const rateBookTutorialSource = fs.readFileSync(rateBookTutorialPath, 'utf-8')
  const savedCostingsTutorialSource = fs.readFileSync(savedCostingsTutorialPath, 'utf-8')

  it('CostEstimateTutorial has no automatic setTimeout or autostart effect launching the tour', () => {
    // In legacy code, there was an effect like:
    // useEffect(() => { if (!hasVisited && !accountDismissed) setActive(true) }, ...)
    // Ensure no automatic setActive(true) or onActiveChange(true) inside mount effects
    expect(costEstimateTutorialSource).not.toMatch(/setTimeout\s*\(\s*\(\)\s*=>\s*\{\s*setActive\(true\)/)
    expect(costEstimateTutorialSource).not.toMatch(/useEffect\s*\(\s*\(\)\s*=>\s*\{[^}]*setActive\(true\)/)
    // The only place setActive(true) should occur is upon user action (e.g. handleLaunch, requestTrigger, or explicit button click)
    const setActiveTrueMatches = costEstimateTutorialSource.match(/setActive\(true\)/g) || []
    // Should only be called inside intentional user handlers
    expect(setActiveTrueMatches.length).toBeLessThanOrEqual(2)
  })

  it('RateBookTutorial has no automatic setTimeout or autostart effect launching the tour', () => {
    expect(rateBookTutorialSource).not.toMatch(/setTimeout\s*\(\s*\(\)\s*=>\s*\{\s*setActive\(true\)/)
    expect(rateBookTutorialSource).not.toMatch(/useEffect\s*\(\s*\(\)\s*=>\s*\{[^}]*setActive\(true\)/)
    const setActiveTrueMatches = rateBookTutorialSource.match(/setActive\(true\)/g) || []
    expect(setActiveTrueMatches.length).toBeLessThanOrEqual(2)
  })

  it('SavedCostingsTutorial does not auto-advance or auto-open on mount', () => {
    expect(savedCostingsTutorialSource).not.toMatch(/useEffect\s*\(\s*\(\)\s*=>\s*\{[^}]*onStepChange\([^null]/)
  })

  it('All tour components render TourInvitation for opt-in presentation', () => {
    expect(costEstimateTutorialSource).toContain('<TourInvitation')
    expect(rateBookTutorialSource).toContain('<TourInvitation')
    expect(savedCostingsTutorialSource).toContain('<TourInvitation')
  })

  it('All tour components pass explicit tour IDs to TourInvitation', () => {
    expect(costEstimateTutorialSource).toContain('tourId="cost-estimate"')
    expect(rateBookTutorialSource).toContain('tourId="rate-book"')
    expect(savedCostingsTutorialSource).toContain('tourId="saved-costings"')
  })
})
