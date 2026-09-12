import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { normalizeMachine } from '../app/(dashboard)/owner/production/registers/normalize'
import { BASE_CONTINUITY_PHRASES } from '../lib/i18n/base-continuity-phrases'

const fixture = vi.hoisted(() => ({ query: '', action: vi.fn() }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(fixture.query),
  usePathname: () => '/owner/machines',
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
  createBaseProductionMachine: fixture.action,
  updateBaseProductionMachine: fixture.action,
}))

import MachinesRegister from '../app/(dashboard)/owner/production/registers/MachinesRegister'

const activeMachine1 = normalizeMachine({
  id: 'mach-1',
  name: 'Rapier 1',
  custom_label: 'Main Loom',
  machine_type: 'rapier',
  is_active: true,
})

const activeMachine2 = normalizeMachine({
  id: 'mach-2',
  name: 'Loom 02',
  machine_type: 'power_loom',
  is_active: true,
})

const inactiveMachine = normalizeMachine({
  id: 'mach-3',
  name: 'Machine 03',
  machine_type: 'air_jet',
  is_active: false,
})

const mockMachines = [activeMachine1, activeMachine2, inactiveMachine]

beforeEach(() => {
  fixture.query = ''
  fixture.action.mockClear()
})

describe('Machines Register Premium UI Refinement', () => {
  describe('Page Header & Cohesive Register Surface', () => {
    it('renders the refined page title, subtitle, and + Add machine CTA', () => {
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('Machines')
      expect(html).toContain('Add and manage the machines in your factory.')
      expect(html).toContain('Add machine')
      expect(html).not.toContain('Manage your factory&#x27;s machines.')
    })

    it('renders a contextual safe return link when returnTo is supplied', () => {
      fixture.query = 'returnTo=/owner/assignments'
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('/owner/assignments')
      expect(html).toContain('Back to Machine Assignments')
    })

    it('renders the compact register count in the register header', () => {
      // By default (active only), 2 active machines
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('Machine register · 2')
    })

    it('updates the register count when all machines are shown', () => {
      fixture.query = 'inactive=1'
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('Machine register · 3')
    })
  })

  describe('Toolbar & Active/Inactive Filtering', () => {
    it('defaults to showing active machines only and hides inactive machines', () => {
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('Main Loom')
      expect(html).toContain('Loom 02')
      expect(html).not.toContain('Machine 03')
    })

    it('displays inactive machines when inactive=1 is set', () => {
      fixture.query = 'inactive=1'
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('Main Loom')
      expect(html).toContain('Loom 02')
      expect(html).toContain('Machine 03')
      expect(html).toContain('Inactive')
    })

    it('contains search input and visibility select in toolbar', () => {
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('aria-label="Search machines"')
      expect(html).toContain('placeholder="Search machines..."')
      expect(html).toContain('Active machines')
      expect(html).toContain('All machines')
    })

    it('filters machine rows by name, custom label, and machine type', () => {
      // Search by custom label
      fixture.query = 'search=Main'
      let html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )
      expect(html).toContain('Main Loom')
      expect(html).not.toContain('Loom 02')

      // Search by machine type
      fixture.query = 'search=power loom'
      html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )
      expect(html).toContain('Loom 02')
      expect(html).not.toContain('Main Loom')
    })
  })

  describe('Machine Row Structure & Actions', () => {
    it('renders machine identity with data-i18n-skip on name, type, status, and actions', () => {
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: [activeMachine1],
          today: '2026-09-12',
        })
      )

      // Machine name has data-i18n-skip
      expect(html).toContain('data-i18n-skip="true"')
      expect(html).toContain('Main Loom')
      expect(html).toContain('rapier')

      // Status
      expect(html).toContain('Active')

      // Actions
      expect(html).toContain('View assignments')
      expect(html).toContain('/owner/assignments?machine=mach-1')
      expect(html).toContain('Edit')
      expect(html).toContain('aria-label="Edit Main Loom"')
    })

    it('does not make the machine row clickable as a single navigation link', () => {
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: [activeMachine1],
          today: '2026-09-12',
        })
      )

      // There should only be explicit action links (View assignments), not whole row anchors
      const linkMatches = html.match(/<a\s+[^>]*href="[^"]*"[^>]*>/g) || []
      const assignmentLinks = linkMatches.filter(l => l.includes('/owner/assignments?machine=mach-1'))
      expect(assignmentLinks.length).toBe(1)
    })
  })

  describe('Empty and Search Empty States', () => {
    it('renders compact initial empty state when factory has 0 machines', () => {
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: [],
          today: '2026-09-12',
        })
      )

      expect(html).toContain('Machine register · 0')
      expect(html).toContain('Add your first machine')
      expect(html).toContain('Add machines to manage your factory setup and worker assignments.')
      expect(html).toContain('Add machine')
    })

    it('renders search empty state when filter yields 0 results with recovery actions', () => {
      fixture.query = 'search=NonExistentLoom'
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('No machines found')
      expect(html).toContain('No machines match your current search or filter.')
      expect(html).toContain('Clear search')
      expect(html).toContain('Show all machines')
      expect(html).not.toContain('Add your first machine')
    })
  })

  describe('Semantic Markup & Accessibility', () => {
    it('renders accessible semantic markup with list roles and section labeling', () => {
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('aria-labelledby="machine-register-heading"')
      expect(html).toContain('id="machine-register-heading"')
      expect(html).toContain('role="list"')
      expect(html).toContain('role="listitem"')
      expect(html).not.toContain('role="tablist"')
    })
  })

  describe('Localization Key Coverage', () => {
    it('has Hindi and Gujarati translations for all refined machine phrases', () => {
      const phrases = [
        'Add and manage the machines in your factory.',
        'Machine register',
        'Search machines...',
        'Active machines',
        'All machines',
        'Active',
        'Inactive',
        'View assignments',
        'Edit',
        'Add your first machine',
        'Add machines to manage your factory setup and worker assignments.',
        'No machines found',
        'No machines match your current search or filter.',
        'Clear search',
        'Show all machines',
        "We couldn't load your machines.",
        'Try again',
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
