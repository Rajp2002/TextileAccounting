import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { getMobileWorkflowNavigation, currentMobileWorkflow } from '../lib/mobile-workflow-navigation'
import { groupOwnerNavigation } from '../lib/disclosure-navigation'
import { visibleOwnerNavigation } from '../lib/owner-navigation'
import { MobileWorkflowNavigation } from '../components/navigation/mobile-workflow-navigation'
import type { SubscriptionTier } from '../lib/subscription-access'
import type { ProductionMode } from '../lib/production-mode'
import { en } from '../lib/i18n/locales/en'
import { hi } from '../lib/i18n/locales/hi'
import { gu } from '../lib/i18n/locales/gu'

const location = vi.hoisted(() => ({ pathname: '/owner/estimator' }))
vi.mock('next/navigation', () => ({ usePathname: () => location.pathname }))
vi.mock('../lib/i18n/context', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const sections = (tier: SubscriptionTier = 'base', productionMode: ProductionMode = 'market_run') => visibleOwnerNavigation({ tier, productionMode })
const navigation = (tier: SubscriptionTier = 'base', productionMode: ProductionMode = 'market_run') => getMobileWorkflowNavigation(sections(tier, productionMode), tier)
const activeDestinations = (pathname: string) => navigation().groups.flatMap(group => group.destinations).filter(item => item.active(pathname, item.href))

describe('balanced mobile workflow navigation', () => {
    it.each(['market_run', 'order_based', 'both'] as const)('gives each Base workflow a direct destination in %s mode', mode => {
        expect(navigation('base', mode).primary.map(item => [item.id, item.href, item.translationKey])).toEqual([
            ['costing', '/owner/estimator', 'navigation.sections.costing'],
            ['production', '/owner/production/daily-sheet', 'navigation.production'],
            ['stock', '/owner/stock', 'navigation.stock'],
            ['workforce', '/owner/workers', 'navigation.sections.workforce'],
        ])
    })

    it('keeps all authorized features in contextual navigation or the complete directory', () => {
        const context = navigation().groups.flatMap(group => group.destinations)
        const directory = groupOwnerNavigation(sections(), 'base').flatMap(section => section.nodes.flatMap(node => node.kind === 'group' ? node.children : [node]))
        const retained = new Set([...context, ...directory].map(item => item.href))
        for (const item of sections().flatMap(section => section.items)) expect(retained.has(item.href)).toBe(true)
        expect(navigation().groups.map(group => [group.id, group.destinations.map(item => item.href)])).toEqual([
            ['costing', ['/owner/estimator', '/owner/quotes', '/owner/rates']],
            ['production', ['/owner/production/daily-sheet', '/owner/production', '/owner/assignments', '/owner/machines']],
            ['stock', ['/owner/stock', '/owner/stock/yarn', '/owner/dispatches']],
            ['workforce', ['/owner/workers', '/owner/payroll']],
        ])
        expect(directory.filter(item => ['/owner/settings', '/owner/billing'].includes(item.href))).toHaveLength(2)
    })

    it.each([
        ['/owner/estimator', 'costing', 'estimate'],
        ['/owner/quotes/example', 'costing', 'costings'],
        ['/owner/rates', 'costing', 'rates'],
        ['/owner/production', 'production', 'production_overview'],
        ['/owner/production/quality/example', 'production', 'production_overview'],
        ['/owner/production/daily-sheet', 'production', 'production_daily_sheet'],
        ['/owner/production/daily-sheet/correction', 'production', 'production_daily_sheet'],
        ['/owner/assignments', 'production', 'assignments'],
        ['/owner/machines/example', 'production', 'machines'],
        ['/owner/stock', 'stock', 'fabric'],
        ['/owner/stock/audit', 'stock', 'fabric'],
        ['/owner/stock/yarn/example', 'stock', 'yarn'],
        ['/owner/dispatches/example/print', 'stock', 'dispatches'],
        ['/owner/workers/example', 'workforce', 'workers'],
        ['/owner/payroll', 'workforce', 'payroll'],
    ])('selects one workflow and one contextual destination for %s', (pathname, groupId, destinationId) => {
        const model = navigation()
        expect(model.primary.filter(item => item.active(pathname, item.href)).map(item => item.id)).toEqual([groupId])
        expect(currentMobileWorkflow(model.groups, pathname)?.id).toBe(groupId)
        expect(activeDestinations(pathname).map(item => item.id)).toEqual([destinationId])
    })

    it.each(['/owner/settings', '/owner/billing', '/owner/data-export', '/owner/workers-other', '/owner/production-other'])('leaves %s outside workflow context', pathname => {
        expect(currentMobileWorkflow(navigation().groups, pathname)).toBeNull()
        expect(navigation().primary.some(item => item.active(pathname, item.href))).toBe(false)
    })

    it.each(['free', 'lite', 'none'] as const)('retains the existing direct costing destinations and no contextual header for %s', tier => {
        const model = navigation(tier)
        expect(model.primary.map(item => item.href)).toEqual(tier === 'free' ? ['/free', '/free/costings'] : tier === 'lite' ? ['/owner/estimator', '/owner/quotes', '/owner/rates'] : [])
        expect(model.groups).toEqual([])
        expect(model.primary.some(item => ['/owner/production/daily-sheet', '/owner/stock', '/owner/workers'].includes(item.href))).toBe(false)
    })

    it('does not reconstruct destinations removed by the capability-filtered source', () => {
        const filtered = sections().map(section => ({ ...section, items: section.items.filter(item => ['costings', 'assignments', 'dispatches', 'payroll', 'billing'].includes(item.id)) }))
        const model = getMobileWorkflowNavigation(filtered, 'base')
        expect(model.primary.map(item => item.href)).toEqual(['/owner/quotes', '/owner/assignments', '/owner/dispatches', '/owner/payroll'])
        expect(model.groups.flatMap(group => group.destinations).map(item => item.id)).toEqual(['costings', 'assignments', 'dispatches', 'payroll'])
        expect(getMobileWorkflowNavigation([], 'base')).toEqual({ primary: [], groups: [] })
    })

    it.each([en, hi, gu])('provides localized labels for every mobile destination', locale => {
        const labels = new Set(['common.more'])
        for (const tier of ['base', 'lite', 'free'] as const) {
            const model = navigation(tier)
            for (const destination of [...model.primary, ...model.groups.flatMap(group => group.destinations)]) labels.add(destination.translationKey)
        }
        for (const key of labels) {
            let value: unknown = locale
            for (const segment of key.split('.')) value = (value as Record<string, unknown>)[segment]
            expect(typeof value).toBe('string')
            expect(value).toBeTruthy()
        }
    })
})

describe('contextual navigation semantics', () => {
    it('uses real route links with exactly one current destination and 44px targets', () => {
        location.pathname = '/owner/production/daily-sheet'
        const html = renderToStaticMarkup(createElement(MobileWorkflowNavigation, { tier: 'base', productionMode: 'market_run' }))
        for (const href of ['/owner/production/daily-sheet', '/owner/production', '/owner/assignments', '/owner/machines']) expect(html).toContain(`href="${href}"`)
        expect(html.match(/aria-current="page"/g)).toHaveLength(1)
        expect(html).toContain('min-h-[44px]')
        expect(html).toContain('overflow-x-auto')
        expect(html).not.toMatch(/role="(?:tab|tablist|menu|menuitem)"/)
    })

    it('distinguishes an exact destination from its record detail', () => {
        location.pathname = '/owner/stock/yarn/example'
        const html = renderToStaticMarkup(createElement(MobileWorkflowNavigation, { tier: 'base', productionMode: 'market_run' }))
        expect(html.match(/aria-current="location"/g)).toHaveLength(1)
        expect(html).not.toContain('aria-current="page"')
    })

    it.each(['free', 'lite', 'none'] as const)('renders no contextual header for %s', tier => {
        location.pathname = '/owner/estimator'
        expect(renderToStaticMarkup(createElement(MobileWorkflowNavigation, { tier, productionMode: 'market_run' }))).toBe('')
    })
})
