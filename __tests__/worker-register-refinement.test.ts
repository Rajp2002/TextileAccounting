import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { normalizeWorker } from '../app/(dashboard)/owner/production/registers/normalize'
import { BASE_CONTINUITY_PHRASES } from '../lib/i18n/base-continuity-phrases'

const fixture = vi.hoisted(() => ({ query: '', action: vi.fn() }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(fixture.query),
  usePathname: () => '/owner/workers',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
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

import WorkersRegister from '../app/(dashboard)/owner/production/registers/WorkersRegister'

const pieceWorkerActive = normalizeWorker({
  id: 'worker-1',
  name: 'Rami Weaver',
  pay_type: 'piece_rate',
  shift_availability: 'day',
  is_active: true,
})

const fixedWorkerActive = normalizeWorker({
  id: 'worker-2',
  name: 'Suresh Master',
  pay_type: 'fixed_monthly',
  role: 'Weaving Master',
  monthly_salary: '25000',
  is_active: true,
})

const inactivePieceWorker = normalizeWorker({
  id: 'worker-3',
  name: 'Kanti Operator',
  pay_type: 'piece_rate',
  shift_availability: 'night',
  is_active: false,
})

const mockWorkers = [pieceWorkerActive, fixedWorkerActive, inactivePieceWorker]

beforeEach(() => {
  fixture.query = ''
  fixture.action.mockClear()
})

describe('Workforce Register Premium UI Redesign', () => {
  describe('Page Header & Workforce Register Surface', () => {
    it('renders the refined page title, subtitle, and + Add worker button', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('Workers')
      expect(html).toContain('Add and manage your factory workforce.')
      expect(html).toContain('Add worker')
      expect(html).not.toContain('Manage piece-rate and fixed-salary workers.')
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

    it('renders the focus alert banner when focus query parameter is set', () => {
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

    it('displays grammatical count in the register header: singular and plural', () => {
      // Plural: 2 active workers by default
      let html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )
      expect(html).toContain('Workforce register')
      expect(html).toContain('2 workers')

      // Singular: 1 worker
      html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: [pieceWorkerActive],
          today: '2026-09-12',
        })
      )
      expect(html).toContain('1 worker')

      // Inactive shown: 3 workers
      fixture.query = 'inactive=1'
      html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )
      expect(html).toContain('3 workers')
    })
  })

  describe('Toolbar, Search & Filtering', () => {
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

    it('displays inactive workers when inactive=1 is set', () => {
      fixture.query = 'inactive=1'
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

    it('renders search input with icon, placeholder and accessible label', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('aria-label="Search workers"')
      expect(html).toContain('placeholder="Search workers…"')
    })

    it('renders custom pay type select with All pay types, Piece rate, Fixed salary', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('All pay types')
      expect(html).toContain('Piece rate')
      expect(html).toContain('Fixed salary')
    })

    it('filters by pay type correctly', () => {
      fixture.query = 'payType=fixed_monthly'
      let html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )
      expect(html).toContain('Suresh Master')
      expect(html).not.toContain('Rami Weaver')

      fixture.query = 'payType=piece_rate'
      html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )
      expect(html).toContain('Rami Weaver')
      expect(html).not.toContain('Suresh Master')
    })

    it('filters by search input matching worker name and role', () => {
      fixture.query = 'search=Master'
      let html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )
      expect(html).toContain('Suresh Master')
      expect(html).not.toContain('Rami Weaver')

      fixture.query = 'search=Rami'
      html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )
      expect(html).toContain('Rami Weaver')
      expect(html).not.toContain('Suresh Master')
    })
  })

  describe('Worker Row Hierarchy & Actions', () => {
    it('renders worker identity with data-i18n-skip, shift/role, text-first pay type, and status', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: [pieceWorkerActive],
          today: '2026-09-12',
        })
      )

      expect(html).toContain('data-i18n-skip="true"')
      expect(html).toContain('Rami Weaver')
      expect(html).toContain('Day shift')
      expect(html).toContain('Piece rate')
      expect(html).toContain('Active')
      expect(html).toContain('View assignments')
      expect(html).toContain('/owner/assignments?worker=worker-1')
      expect(html).toContain('Edit')
      expect(html).toContain('aria-label="Edit Rami Weaver"')
    })

    it('omits machine assignments link for fixed salary workers', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: [fixedWorkerActive],
          today: '2026-09-12',
        })
      )

      expect(html).toContain('Suresh Master')
      expect(html).toContain('Fixed salary')
      expect(html).not.toContain('/owner/assignments?worker=worker-2')
      expect(html).toContain('Edit')
    })

    it('does not make the worker row itself a clickable anchor', () => {
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
    it('renders compact initial empty state when factory has 0 workers', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: [],
          today: '2026-09-12',
        })
      )

      expect(html).toContain('0 workers')
      expect(html).toContain('Add your first worker')
      expect(html).toContain('Add workers to manage payroll and machine assignments.')
      expect(html).toContain('Add worker')
    })

    it('renders no-results state with Clear filters action when search returns 0', () => {
      fixture.query = 'search=UnknownPerson'
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('No workers found')
      expect(html).toContain('No workers match your current search or filters.')
      expect(html).toContain('Clear filters')
      expect(html).not.toContain('Add your first worker')
    })
  })

  describe('Semantic Markup & Accessibility', () => {
    it('renders accessible semantic markup with section labeling and list roles', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkersRegister, {
          workers: mockWorkers,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('aria-labelledby="workforce-register-heading"')
      expect(html).toContain('id="workforce-register-heading"')
      expect(html).toContain('role="list"')
      expect(html).toContain('role="listitem"')
      expect(html).not.toContain('role="tablist"')
    })
  })

  describe('Localization Key Coverage', () => {
    it('has Hindi and Gujarati translations for all refined workforce phrases', () => {
      const phrases = [
        'Add and manage your factory workforce.',
        'Workforce register',
        'Search workers…',
        'Search workers',
        'All pay types',
        'Piece rate',
        'Fixed salary',
        'Active workers',
        'All workers',
        'Add worker',
        '1 worker',
        'workers',
        'worker',
        'Add workers to manage payroll and machine assignments.',
        'No workers found',
        'No workers match your current search or filters.',
        'Clear filters',
        "We couldn't load your workers.",
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
