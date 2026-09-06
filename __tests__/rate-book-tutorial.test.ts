import { beforeEach, describe, expect, it, vi } from 'vitest'
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

import {
    rateBookTutorialCopy,
    isRatebookTutorialField,
} from '../lib/i18n/rate-book-tutorial'
import { dismissRatebookTutorial } from '../app/(dashboard)/owner/rates/tutorial-actions'

beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireRole.mockResolvedValue({ user: { id: 'owner-1', user_metadata: { name: 'Owner' } } })
    mocks.updateUser.mockResolvedValue({
        data: { user: { user_metadata: { ratebook_tutorial_dismissed: true } } },
        error: null,
    })
})

describe('Rate Book Guided Tour i18n & Integrity', () => {
    it('provides exactly 6 sections for en, hi, and gu', () => {
        for (const lang of ['en', 'hi', 'gu'] as const) {
            const copy = rateBookTutorialCopy[lang]
            expect(copy.sections).toHaveLength(6)
            expect(copy.replay).toBeTruthy()
            expect(copy.skip).toBeTruthy()
            expect(copy.next).toBeTruthy()
            expect(copy.back).toBeTruthy()
            expect(copy.finish).toBeTruthy()
        }
    })

    it('has matching field keys across en, hi, and gu', () => {
        const enFields = Object.keys(rateBookTutorialCopy.en.fields).sort()
        const hiFields = Object.keys(rateBookTutorialCopy.hi.fields).sort()
        const guFields = Object.keys(rateBookTutorialCopy.gu.fields).sort()

        expect(enFields).toEqual(hiFields)
        expect(enFields).toEqual(guFields)
        expect(enFields.length).toBeGreaterThanOrEqual(20)
    })

    it('validates fields with isRatebookTutorialField', () => {
        expect(isRatebookTutorialField('yarnRow')).toBe(true)
        expect(isRatebookTutorialField('yarnSearch')).toBe(true)
        expect(isRatebookTutorialField('confirmAll')).toBe(true)
        expect(isRatebookTutorialField('quickEditPopover')).toBe(true)
        expect(isRatebookTutorialField('nonExistentField')).toBe(false)
    })
})

describe('RatesClient Integration & Overlay Stability', () => {
    const ratesClientPath = path.resolve(__dirname, '../app/(dashboard)/owner/rates/RatesClient.tsx')
    const ratesClientSource = fs.readFileSync(ratesClientPath, 'utf8')
    const tutorialPath = path.resolve(__dirname, '../components/rates/RateBookTutorial.tsx')
    const tutorialSource = fs.readFileSync(tutorialPath, 'utf8')
    const ratesPagePath = path.resolve(__dirname, '../app/(dashboard)/owner/rates/page.tsx')
    const ratesPageSource = fs.readFileSync(ratesPagePath, 'utf8')

    it('attaches data-ratebook-tutorial-root to RatesClient container', () => {
        expect(ratesClientSource).toContain('data-ratebook-tutorial-root="true"')
    })

    it('embeds RateBookTutorial component in RatesClient', () => {
        expect(ratesClientSource).toContain('<RateBookTutorial')
        expect(ratesClientSource).toContain("import { RateBookTutorial } from '@/components/rates/RateBookTutorial'")
    })

    it('passes tutorialDismissed, userId, and orgId from RatesPage', () => {
        expect(ratesPageSource).toContain('tutorialDismissed={user.user_metadata?.ratebook_tutorial_dismissed === true}')
        expect(ratesPageSource).toContain('userId={user.id}')
        expect(ratesPageSource).toContain('orgId={profile.org_id}')
    })

    it('tags core sections and interactive fields with data-ratebook attributes', () => {
        const expectedFields = [
            'yarnSearch',
            'directionFilter',
            'needsReviewFilter',
            'confirmAll',
            'yarnRow',
            'yarnNameCell',
            'rateAndTrend',
            'reviewStatusBadge',
            'linkedQualitiesPopover',
            'quickReviewAction',
            'quickEditAction',
            'quickEditPopover',
            'addRateAction',
            'rateDrawerFields',
            'reviewRailWidget',
            'activityAndArchive',
        ]

        for (const field of expectedFields) {
            expect(ratesClientSource).toContain(`data-ratebook-field="${field}"`)
        }
    })

    it('passes hideOverlay={isTutorialActive} to SheetContent and DueForReviewDialog to prevent overlay clash', () => {
        expect(ratesClientSource).toContain('hideOverlay={isTutorialActive}')
    })

    it('RateBookTutorial component includes dual spotlight and smart panel placement', () => {
        expect(tutorialSource).toContain('clipPath')
        expect(tutorialSource).toContain('panelPlacement')
        expect(tutorialSource).toContain('data-testid="rate-book-tutorial"')
    })

    it('RateBookTutorial manages keyboard navigation (Enter, Escape, ArrowLeft, ArrowRight)', () => {
        expect(tutorialSource).toContain("event.key === 'Escape'")
        expect(tutorialSource).toContain("event.key === 'Enter'")
        expect(tutorialSource).toContain("event.key === 'ArrowRight'")
        expect(tutorialSource).toContain("event.key === 'ArrowLeft'")
    })

    it('renders RateBookTutorial inside .rates-left-rail-desktop pinned to top of left rail', () => {
        expect(ratesClientSource).toContain('<aside className="rates-left-rail-desktop')
        const leftRailIndex = ratesClientSource.indexOf('className="rates-left-rail-desktop')
        const tutorialIndex = ratesClientSource.indexOf('<RateBookTutorial', leftRailIndex)
        expect(tutorialIndex).toBeGreaterThan(leftRailIndex)
    })

    it('defines responsive positioning for .rates-left-rail-desktop in globals.css matching Cost Estimator', () => {
        const stylesPath = path.resolve(__dirname, '../app/globals.css')
        const styles = fs.readFileSync(stylesPath, 'utf8')

        expect(styles).toContain('.rates-left-rail-desktop')
        expect(styles).toMatch(/@media\s*\(min-width:\s*1660px\)\s*\{[\s\S]*?\.rates-left-rail-desktop\s*\{[\s\S]*?position:\s*fixed/)
        expect(styles).toMatch(/@media\s*\(min-width:\s*1660px\)\s*\{[\s\S]*?\.rates-left-rail-desktop\s*\{[\s\S]*?top:\s*6\.5rem/)
        expect(styles).toMatch(/@media\s*\(min-width:\s*1660px\)\s*\{[\s\S]*?\.rates-left-rail-desktop\s*\{[\s\S]*?left:\s*calc\(248px\s*\+\s*1rem\)/)
        expect(styles).toMatch(/@media\s*\(min-width:\s*1660px\)\s*\{[\s\S]*?\.rates-left-rail-desktop\s*\{[\s\S]*?width:\s*14rem/)
    })

    it('dismissRatebookTutorial updates user metadata and revalidates /owner/rates', async () => {
        const res = await dismissRatebookTutorial()
        expect(res).toEqual({ success: true })
        expect(mocks.requireRole).toHaveBeenCalledWith(['owner'])
        expect(mocks.updateUser).toHaveBeenCalledWith({
            data: { ratebook_tutorial_dismissed: true },
        })
        expect(mocks.revalidatePath).toHaveBeenCalledWith('/owner/rates')
    })

    it('mounts RateBookTutorial exactly once to prevent duplicate portals and inert focus collisions', () => {
        const matches = ratesClientSource.match(/<RateBookTutorial\b/g)
        expect(matches).toHaveLength(1)
        expect(ratesClientSource).toContain('<RateBookTutorialLauncher')
    })

    it('provides reliable skip tour and backdrop dismissal', () => {
        expect(tutorialSource).toContain('data-tour-control="skip"')
        expect(tutorialSource).toContain('data-ratebook-portal="true"')
        expect(tutorialSource).toContain('onClick={(e) => {')
    })
})

