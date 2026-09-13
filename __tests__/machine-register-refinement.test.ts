import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { normalizeMachine } from '../app/(dashboard)/owner/production/registers/normalize'
import { BASE_CONTINUITY_PHRASES } from '../lib/i18n/base-continuity-phrases'
import type { BaseProductionMachineWithReadiness } from '../lib/machine-readiness'

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

const activeMachine1: BaseProductionMachineWithReadiness = {
  ...normalizeMachine({
    id: 'mach-1',
    name: 'Rapier 1',
    custom_label: 'Main Loom',
    machine_type: 'rapier',
    is_active: true,
  }),
  assignedWorkerName: 'Ramesh Patel',
  assignedCostingLabel: 'Quality 60x60 Cotton',
  hasWorker: true,
  hasCosting: true,
}

const activeMachine2: BaseProductionMachineWithReadiness = {
  ...normalizeMachine({
    id: 'mach-2',
    name: 'Loom 02',
    machine_type: 'power_loom',
    is_active: true,
  }),
  assignedWorkerName: 'Suresh Kumar',
  assignedCostingLabel: 'Loom Fabric 40s',
  hasWorker: true,
  hasCosting: true,
}

const needsSetupMachine: BaseProductionMachineWithReadiness = {
  ...normalizeMachine({
    id: 'mach-3',
    name: 'Machine 03',
    machine_type: 'air_jet',
    is_active: true,
  }),
  assignedWorkerName: null,
  assignedCostingLabel: null,
  hasWorker: false,
  hasCosting: false,
}

const mockMachines = [activeMachine1, activeMachine2, needsSetupMachine]

beforeEach(() => {
  fixture.query = ''
  fixture.action.mockClear()
})

describe('Machines Register Premium UI Redesign', () => {
  describe('Page Header & Toolbar Overview', () => {
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
      // Old table heading removed
      expect(html).not.toContain('Machine register ·')
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

    it('renders the machine count in the toolbar', () => {
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('3 machines')
    })
  })

  describe('Toolbar & Operational Readiness Filtering', () => {
    it('contains search input and status filter dropdown in toolbar', () => {
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('aria-label="Search machines"')
      expect(html).toContain('placeholder="Search machines..."')
      expect(html).toContain('aria-label="Status filter"')
      expect(html).toContain('All machines')
      expect(html).toContain('Active machines')
      expect(html).toContain('Needs setup')
    })

    it('shows all machines by default (status=all)', () => {
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('Main Loom')
      expect(html).toContain('Loom 02')
      expect(html).toContain('Machine 03')
    })

    it('filters to active machines only when status=active', () => {
      fixture.query = 'status=active'
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('Main Loom')
      expect(html).toContain('Loom 02')
      expect(html).not.toContain('Machine 03')
      expect(html).toContain('2 / 3 machines')
    })

    it('filters to needs_setup machines only when status=needs_setup', () => {
      fixture.query = 'status=needs_setup'
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )

      expect(html).not.toContain('Main Loom')
      expect(html).not.toContain('Loom 02')
      expect(html).toContain('Machine 03')
      expect(html).toContain('1 / 3 machines')
    })

    it('filters machines by name, custom label, machine type, worker, and costing', () => {
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
      expect(html).not.toContain('Machine 03')

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
      expect(html).not.toContain('Machine 03')

      // Search by worker name
      fixture.query = 'search=Ramesh'
      html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )
      expect(html).toContain('Main Loom')
      expect(html).not.toContain('Loom 02')

      // Search by costing label
      fixture.query = 'search=Cotton'
      html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )
      expect(html).toContain('Main Loom')
      expect(html).not.toContain('Loom 02')
    })
  })

  describe('Machine Card Structure & Deep Linking', () => {
    it('renders machine card with identity, operational details, and status badge', () => {
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

      // Status badge
      expect(html).toContain('Active')

      // Configuration details
      expect(html).toContain('Worker')
      expect(html).toContain('Ramesh Patel')
      expect(html).toContain('Costing')
      expect(html).toContain('Quality 60x60 Cotton')

      // Deep linking action to Machine Assignments with focused machine query
      expect(html).toContain('View assignment')
      expect(html).toContain('href="/owner/assignments?machine=mach-1"')
      expect(html).toContain('aria-label="View assignment for Main Loom"')

      // Edit action
      expect(html).toContain('Edit')
      expect(html).toContain('aria-label="Edit Main Loom"')
    })

    it('renders Not assigned for worker and costing when missing', () => {
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: [needsSetupMachine],
          today: '2026-09-12',
        })
      )

      expect(html).toContain('Machine 03')
      expect(html).toContain('Needs setup')
      expect(html).toContain('Not assigned')
    })

    it('does not make the entire machine card clickable as a single navigation link', () => {
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: [activeMachine1],
          today: '2026-09-12',
        })
      )

      // Only the explicit "View assignment" link exists
      const linkMatches = html.match(/<a\s+[^>]*href="[^"]*"[^>]*>/g) || []
      const assignmentLinks = linkMatches.filter(l => l.includes('/owner/assignments?machine=mach-1'))
      expect(assignmentLinks.length).toBe(1)
    })
  })

  describe('Empty and Filter Recovery States', () => {
    it('renders empty state when factory has 0 machines', () => {
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: [],
          today: '2026-09-12',
        })
      )

      expect(html).toContain('No machines yet')
      expect(html).toContain('Add your first machine to begin configuring your factory.')
      expect(html).toContain('Add machine')
    })

    it('renders search empty state when filter yields 0 results with recovery action', () => {
      fixture.query = 'search=NonExistentLoom'
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('No machines found')
      expect(html).toContain('Try another machine name or clear your filters.')
      expect(html).toContain('Clear search')
      expect(html).not.toContain('No machines yet')
    })

    it('renders status filter empty state when active filter yields 0 results', () => {
      fixture.query = 'status=active'
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: [needsSetupMachine],
          today: '2026-09-12',
        })
      )

      expect(html).toContain('No active machines')
      expect(html).toContain('Machines become active once they have both a worker and costing assigned.')
      expect(html).toContain('Show all machines')
    })
  })

  describe('Semantic Markup & Accessibility', () => {
    it('renders accessible semantic markup with list roles and article card elements', () => {
      const html = renderToStaticMarkup(
        React.createElement(MachinesRegister, {
          machines: mockMachines,
          today: '2026-09-12',
        })
      )

      expect(html).toContain('<ul role="list"')
      expect(html).toContain('<li role="listitem"')
      expect(html).toContain('<article')
      expect(html).not.toContain('role="tablist"')
    })
  })

  describe('Localization Key Coverage', () => {
    it('has Hindi and Gujarati translations for all redesigned machine phrases', () => {
      const phrases = [
        'Add and manage the machines in your factory.',
        'Machine register',
        'Search machines...',
        'Search machines',
        'Active machines',
        'All machines',
        'Needs setup',
        'Worker',
        'Costing',
        'Assigned',
        'Not assigned',
        'Active',
        'Inactive',
        'View assignment',
        'View assignments',
        'View assignment for',
        'Edit',
        'Add machine',
        'Add machines to manage your factory setup and worker assignments.',
        'No machines yet',
        'Add your first machine to begin configuring your factory.',
        'No active machines',
        'Machines become active once they have both a worker and costing assigned.',
        'No machines found',
        'No machines match your current search or filter.',
        'Try another machine name or clear your filters.',
        'Clear search',
        'Clear filters',
        'Show all machines',
        'Status filter',
        'machines',
        'machine',
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
