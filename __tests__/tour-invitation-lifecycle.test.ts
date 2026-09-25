import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  updateUser: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { updateUser: mocks.updateUser } }),
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))

import { getTourStatus } from '../lib/tours/tour-preferences'
import { getTourDefinition } from '../lib/tours/tour-registry'

describe('Tour Invitation Lifecycle & Contract', () => {
  const componentPath = path.resolve(__dirname, '../components/tours/TourInvitation.tsx')
  const hookPath = path.resolve(__dirname, '../hooks/use-tour-invitation.ts')
  const componentSource = fs.readFileSync(componentPath, 'utf-8')
  const hookSource = fs.readFileSync(hookPath, 'utf-8')

  it('TourInvitation component satisfies accessibility and minimum touch target requirements (44x44px)', () => {
    expect(componentSource).toContain('min-h-[44px]')
    expect(componentSource).toContain('min-w-[44px]')
    expect(componentSource).toContain('aria-label')
    expect(componentSource).toContain('data-testid="tour-invitation-dismiss"')
    expect(componentSource).toContain('data-testid="tour-invitation-launch"')
  })

  it('TourInvitation applies tour-halo-active class and globals.css defines tour-halo-pulse keyframes', () => {
    const cssPath = path.resolve(__dirname, '../app/globals.css')
    const cssSource = fs.readFileSync(cssPath, 'utf-8')
    expect(componentSource).toContain('tour-halo-active')
    expect(cssSource).toContain('@keyframes tour-halo-pulse')
    expect(cssSource).toContain('.tour-halo-active::after')
    expect(hookSource).toContain('isReducedMotionPreferred()')
  })

  it('hook manages visit-scoped presentation without premature collapse on impression recording', () => {
    // Check that recording impression does NOT reset presentation to 'quiet'
    expect(hookSource).toContain("if (presentation === 'invitation' && !impressionRecorded.current)")
    expect(hookSource).toContain("impressionRecorded.current = true")
    expect(hookSource).toContain("void persistTourImpression(tourId, userId)")
    // Note: setPresentation('quiet') should only be called in handleDismiss or after explicit action
    expect(hookSource).toMatch(/handleDismiss\s*=\s*useCallback\(\(\)\s*=>\s*\{[^}]*setPresentation\('quiet'\)/)
  })

  it('hook halts halo immediately on keydown, pointerdown, touchstart, or scroll', () => {
    expect(hookSource).toContain("'keydown'")
    expect(hookSource).toContain("'pointerdown'")
    expect(hookSource).toContain("'touchstart'")
    expect(hookSource).toContain("'scroll'")
    expect(hookSource).toContain('stopHalo()')
    // Passive pointer move must NOT cancel halo
    expect(hookSource).toContain("if (event.type === 'pointermove' || event.type === 'mousemove') return")
  })

  it('hook coalesces rapid double-clicks during launch', () => {
    expect(hookSource).toContain('if (isStarting) return')
    expect(hookSource).toContain('setIsStarting(true)')
    expect(hookSource).toContain('setIsStarting(false)')
  })

  it('presentation status transitions from invitation to quiet on subsequent visits', () => {
    const userId = 'user-lifecycle-1'
    // First visit: unshown, undismissed
    const firstVisitStatus = getTourStatus('cost-estimate', null, userId)
    expect(firstVisitStatus.isFirstEligibleVisit).toBe(true)
    expect(firstVisitStatus.isSuppressed).toBe(false)

    // Second visit: impression has been recorded (firstShown timestamp exists)
    const secondVisitStatus = getTourStatus('cost-estimate', {
      tour_preferences: {
        'cost-estimate': {
          firstShown: '2026-09-10T10:00:00Z',
          version: 'v1',
        },
      },
    }, userId)
    expect(secondVisitStatus.isFirstEligibleVisit).toBe(false)
    expect(secondVisitStatus.isSuppressed).toBe(true)

    // Third visit: user explicitly dismissed
    const dismissedStatus = getTourStatus('cost-estimate', {
      tour_preferences: {
        'cost-estimate': {
          dismissed: true,
          version: 'v1',
        },
      },
    }, userId)
    expect(dismissedStatus.isFirstEligibleVisit).toBe(false)
    expect(dismissedStatus.isDismissed).toBe(true)
    expect(dismissedStatus.isSuppressed).toBe(true)
  })

  it('uses the shared quiet rail styling for every launcher presentation', () => {
    const rail = fs.readFileSync(path.resolve(__dirname, '../components/ui/rail.ts'), 'utf8')
    expect(componentSource).toContain('railSurface')
    expect(componentSource).toContain('railButton')
    expect(componentSource).not.toContain('amber')
    expect(rail).toContain('border-hairline')
    expect(rail).toContain('hover:bg-surface-soft')
    expect(rail).toContain('shadow-xs')
  })
})
