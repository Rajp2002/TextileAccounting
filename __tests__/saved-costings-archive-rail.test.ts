import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Saved Costings archive policy rail layout', () => {
    const quotes = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
    const styles = read('app/globals.css')

    it('anchors archive policy to the bottom of the desktop rail and keeps it reachable on narrow screens above the phone', () => {
        const routeArchiveStart = quotes.indexOf('<ArchivePolicyNotice />')
        const railStart = quotes.indexOf('<aside className="saved-costings-archive-rail-desktop')
        const railArchiveStart = quotes.indexOf('<ArchivePolicyNotice />', railStart)
        const railEnd = quotes.indexOf('</aside>', railStart)

        expect(quotes).toContain('<div className="phone-guidance rail-inline-actions">')
        expect(routeArchiveStart).toBeGreaterThanOrEqual(0)
        expect(railStart).toBeGreaterThan(routeArchiveStart)
        expect(railArchiveStart).toBeGreaterThan(railStart)
        expect(railArchiveStart).toBeLessThan(railEnd)
        expect(styles).toContain('.saved-costings-archive-rail-desktop')
        expect(styles).toMatch(/\.saved-costings-archive-rail-desktop,[\s\S]*?\{[\s\S]*?position:\s*fixed;[\s\S]*?bottom:\s*var\(--rail-bottom\);/)
    })
})
