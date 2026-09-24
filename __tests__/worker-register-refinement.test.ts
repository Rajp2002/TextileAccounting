import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { normalizeWorker } from '../app/(dashboard)/owner/production/registers/normalize'
import { BASE_CONTINUITY_PHRASES } from '../lib/i18n/base-continuity-phrases'
import type { BaseProductionWorkerWithOperational } from '../lib/worker-operational'

const fixture = vi.hoisted(() => ({ query: '', action: vi.fn() }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(fixture.query),
  usePathname: () => '/owner/workers',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    language: 'en',
    tx: (text: string) => text,
    t: (text: string) => text,
  }),
}))
vi.mock('@/components/navigation/navigation-link', () => ({
  NavigationLink: ({ children, ...props }: React.ComponentProps<'a'>) =>
    React.createElement('a', props, children),
}))
vi.mock('../app/(dashboard)/owner/production/actions', () => ({
  createBaseProductionWorker: fixture.action,
  updateBaseProductionWorker: fixture.action,
}))

vi.mock('@/app/actions/tour-preferences', () => ({ recordTourEventAction: vi.fn() }))

import WorkersRegister from '../app/(dashboard)/owner/production/registers/WorkersRegister'

const pieceWorkerActive: BaseProductionWorkerWithOperational = {
  ...normalizeWorker({
    id: 'worker-1',
    name: 'Rami Weaver',
    pay_type: 'piece_rate',
    rate_per_meter: 4.5,
    shift_availability: 'day',
    is_active: true,
  }),
  assignedMachineCount: 3,
}

const fixedWorkerActive: BaseProductionWorkerWithOperational = {
  ...normalizeWorker({
    id: 'worker-2',
    name: 'Suresh Master',
    pay_type: 'fixed_monthly',
    role: 'Weaving Master',
    monthly_salary: '25000',
    start_date: '2026-01-01',
    shift_availability: 'both',
    is_active: true,
  }),
  assignedMachineCount: 0,
}

const inactivePieceWorker: BaseProductionWorkerWithOperational = {
  ...normalizeWorker({
    id: 'worker-3',
    name: 'Kanti Operator',
    pay_type: 'piece_rate',
    rate_per_meter: 0,
    shift_availability: 'night',
    is_active: false,
  }),
  assignedMachineCount: 0,
}

const mockWorkers = [pieceWorkerActive, fixedWorkerActive, inactivePieceWorker]

beforeEach(() => {
  fixture.query = ''
  fixture.action.mockClear()
})

describe('Workforce Register Premium Redesign', () => {
  describe('Page Header & Workforce Groups Structure', () => {
    it('renders a centered page title with the worker count in the toolbar', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )

      const header = html.match(/<header[^>]*>[\s\S]*?<\/header>/)?.[0]
      expect(header).toContain('text-center')
      expect(header).toMatch(/<h1[^>]*>Workers<\/h1>/)
      expect(header).not.toContain('3 workers')
      expect(html).toContain('3 workers')
      expect(html).toContain('Add worker')
      // Old table wrapper heading removed
      expect(html).not.toContain('Workforce register')
    })

    it('renders two distinct workforce sections: Piece Rate and Fixed Salary', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('Piece Rate')
      expect(html).toContain('Paid based on production')
      expect(html).toContain('Fixed Salary')
      expect(html).toContain('Fixed monthly compensation')
    })

    it('renders a contextual return link when returnTo is provided', () => {
      fixture.query = 'returnTo=/owner/assignments'
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('/owner/assignments')
      expect(html).toContain('Back to Machine Assignments')
    })

    it('renders the focus alert banner when worker query parameter is set', () => {
      fixture.query = 'worker=worker-1'
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('Worker filter active')
      expect(html).toContain('Clear filter')
    })
  })

  describe('Global Toolbar, Search & Filtering', () => {
    it('contains search, shift filter, and worker status filter in toolbar', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('aria-label="Search workers"')
      expect(html).toContain('placeholder="Search workers…"')
      expect(html).toContain('aria-label="Shift filter"')
      expect(html).toContain('All shifts')
      expect(html).toContain('aria-label="Worker status filter"')
      expect(html).toContain('Active workers')
      expect(html).toContain('All workers')
      expect(html).toContain('Inactive workers')
    })

    it('defaults to showing active workers only and hides inactive workers', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('Rami Weaver')
      expect(html).toContain('Suresh Master')
      expect(html).not.toContain('Kanti Operator')
    })

    it('displays inactive workers when status=all or inactive=1', () => {
      fixture.query = 'status=all'
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('Rami Weaver')
      expect(html).toContain('Suresh Master')
      expect(html).toContain('Kanti Operator')
      expect(html).toContain('Inactive')
    })

    it('filters workers by shift availability', () => {
      fixture.query = 'shift=night'
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )

      // Suresh is available for 'both', so night shift matches Suresh
      expect(html).toContain('Suresh Master')
      // Rami is 'day' only
      expect(html).not.toContain('Rami Weaver')
    })

    it('operates search across both groups and hides empty group', () => {
      // Search matches only Fixed Salary
      fixture.query = 'search=Master'
      let html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )
      expect(html).toContain('Suresh Master')
      expect(html).not.toContain('Rami Weaver')
      expect(html).not.toMatch(/<h2[^>]*>Piece Rate<\/h2>/)

      // Search matches only Piece Rate
      fixture.query = 'search=Rami'
      html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )
      expect(html).toContain('Rami Weaver')
      expect(html).not.toContain('Suresh Master')
      expect(html).not.toMatch(/<h2[^>]*>Fixed Salary<\/h2>/)
    })
  })

  describe('Worker Cards & Operational Details', () => {
    it('renders piece-rate card with assigned machines, quality wage source, and View assignments deep link', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: [pieceWorkerActive],
          today: '2026-09-12',
        })
      )

      expect(html).toContain('data-i18n-skip="true"')
      expect(html).toContain('Rami Weaver')
      expect(html).toContain('Day shift')
      expect(html).toContain('Active')

      // The register identifies the quality wage source, not a legacy worker-rate readiness flag.
      expect(html).toContain('Machines')
      expect(html).toContain('3 assigned')
      expect(html).toContain('Wage source')
      expect(html).toContain('Production quality')
      expect(html).not.toContain('Rate setup')

      // Deep link to Machine Assignments
      expect(html).toContain('View assignments')
      expect(html).toContain('/owner/assignments?worker=worker-1')
      expect(html).toContain('aria-label="View machine assignments for Rami Weaver"')

      // Edit action
      expect(html).toContain('Edit')
      expect(html).toContain('aria-label="Edit Rami Weaver"')
    })

    it('renders fixed-salary card with salary config, payroll status, and View payroll link (without raw salary amounts)', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: [fixedWorkerActive],
          today: '2026-09-12',
        })
      )

      expect(html).toContain('Suresh Master')
      expect(html).toContain('Weaving Master')
      expect(html).toContain('Active')

      // 2-column configuration: Salary & Payroll
      expect(html).toContain('Salary')
      expect(html).toContain('Configured')
      expect(html).toContain('Payroll')
      expect(html).toContain('Ready')

      // Privacy: raw salary amount is NOT displayed on card overview
      expect(html).not.toContain('25000')
      expect(html).not.toContain('₹25,000')

      // Action: View payroll
      expect(html).toContain('View payroll')
      expect(html).toContain('href="/owner/payroll"')
      expect(html).toContain('aria-label="View payroll for Suresh Master"')
    })

    it('does not make the entire worker card clickable as a single navigation link', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: [pieceWorkerActive],
          today: '2026-09-12',
        })
      )

      const linkMatches = html.match(/<a\s+[^>]*href="[^"]*"[^>]*>/g) || []
      const assignmentLinks = linkMatches.filter(l => l.includes('/owner/assignments?worker=worker-1'))
      expect(assignmentLinks.length).toBe(1)
    })
  })

  describe('Empty and No-Results States', () => {
    it('renders empty state when factory has 0 workers registered', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: [],
          today: '2026-09-12',
        })
      )

      expect(html).toContain('No workers yet')
      expect(html).toContain('Add workers to start building your factory workforce.')
      expect(html).toContain('Add worker')
    })

    it('renders no-results state with Clear filters when search returns 0 across both groups', () => {
      fixture.query = 'search=NonExistentWorker'
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('No workers found')
      expect(html).toContain('Try another name or clear your filters.')
      expect(html).toContain('Clear filters')
      expect(html).not.toContain('No workers yet')
    })

    it('renders compact group empty state when one group has no workers', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: [pieceWorkerActive],
          today: '2026-09-12',
        })
      )

      expect(html).toContain('Rami Weaver')
      expect(html).toContain('No fixed-salary workers')
    })
  })

  describe('Semantic Markup & Accessibility', () => {
    it('renders accessible semantic markup with article cards and role=list', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('role="list"')
      expect(html).toContain('role="listitem"')
      expect(html).toContain('<article')
    })
  })

  describe('Localization Key Coverage', () => {
    it('has Hindi and Gujarati translations for all redesigned workforce phrases', () => {
      const phrases = [
        'Add and manage your factory workforce.',
        'Workers',
        'Piece Rate',
        'Fixed Salary',
        'Paid based on production',
        'Fixed monthly compensation',
        'Search workers…',
        'Search workers',
        'All shifts',
        'Shift filter',
        'Worker status filter',
        'Active workers',
        'Inactive workers',
        'All workers',
        'Add worker',
        '1 worker',
        'workers',
        'worker',
        'Machines',
        'Rate setup',
        'Salary',
        'Payroll',
        'Configured',
        'Not configured',
        'Ready',
        'Needs setup',
        'View assignments',
        'View payroll',
        'Edit',
        'No workers yet',
        'Add workers to start building your factory workforce.',
        'No workers found',
        'Try another name or clear your filters.',
        'Clear filters',
        'No piece-rate workers',
        'No fixed-salary workers',
      ]

      const hi = BASE_CONTINUITY_PHRASES.hi as Record<string, string>
      const gu = BASE_CONTINUITY_PHRASES.gu as Record<string, string>

      for (const phrase of phrases) {
        expect(hi[phrase]).toBeDefined()
        expect(hi[phrase].length).toBeGreaterThan(0)
        expect(gu[phrase]).toBeDefined()
        expect(gu[phrase].length).toBeGreaterThan(0)
      }
    })
  })
})
