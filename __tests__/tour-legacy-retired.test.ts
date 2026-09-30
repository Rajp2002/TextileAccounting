import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

// GT-16: tour code that GT-03..GT-15 left without callers stays deleted, and the shared runtime it sat beside stays.
const read = (file: string) => readFileSync(file, 'utf8')

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const full = path.join(dir, name)
        if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(full)
        return /\.(ts|tsx)$/.test(name) ? [full] : []
    })
}
const application = ['app', 'components', 'hooks', 'lib'].flatMap(sourceFiles)

describe('GT-16: retired legacy tour code', () => {
    it('removes the deprecated placement hook and its type, and keeps the shared hooks', () => {
        const hook = read('hooks/use-guided-tour.ts')
        expect(hook).not.toMatch(/useGuidedTourPlacement|\bTourPlacement\b/)
        for (const kept of ['useGuidedTourModal', 'useTourStep', 'captureFocusReturn', 'TourStepStatus', 'lockTourViewport']) expect(hook).toContain(kept)
    })

    it('removes the orphaned viewport-lock hook while the shared lock it wrapped stays in use', () => {
        expect(existsSync('hooks/use-tour-viewport-lock.ts')).toBe(false)
        expect(read('lib/tutorial-viewport-lock.ts')).toContain('export function lockTourViewport')
        expect(read('hooks/use-guided-tour.ts')).toContain("from '@/lib/tutorial-viewport-lock'")
    })

    it('keeps one invitation layout (full-width guide card) plus the compact replay launcher', () => {
        const invitation = read('components/tours/TourInvitation.tsx')
        expect(invitation).not.toContain('tour-invitation-container')
        expect(invitation).not.toMatch(/'start'|'end'|align\s*[!=]==/)
        expect(invitation).toContain("presentation === 'invite'")
        expect(invitation).toContain('data-tour-control="take-tour"')
        expect(invitation).toContain('data-tour-control="quiet-tour"')
        expect(invitation).toContain('data-tour-control="dismiss"')
    })

    it('leaves no application source referencing anything that was retired', () => {
        for (const retired of ['useGuidedTourPlacement', 'useTourViewportLock', 'use-tour-viewport-lock', 'tour-invitation-container', 'getTourStatus']) {
            const users = application.filter(file => read(file).includes(retired))
            expect(users, `${retired} referenced in ${users.join(', ')}`).toEqual([])
        }
    })

    it('every remaining caller of TourInvitation asks for the one layout that exists', () => {
        const callers = application.filter(file => read(file).includes('<TourInvitation'))
        expect(callers.length).toBeGreaterThanOrEqual(7)
        for (const file of callers) expect(read(file), file).not.toMatch(/align=["'](start|end)["']/)
    })
})
