import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Saved Costings archive policy', () => {
    const quotes = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
    const styles = read('app/globals.css')

    it('lists the archive policy as a Guide topic in the page header instead of a rail pill', () => {
        const header = quotes.slice(quotes.indexOf('<PageHeader'), quotes.indexOf('data-tour-anchor="costings.new"'))
        expect(quotes).toContain('const archivePolicyTopic = useArchivePolicyTopic()')
        expect(header).toContain('topics={[archivePolicyTopic]}')
        expect(quotes).not.toContain('<ArchivePolicyNotice')
        expect(quotes).not.toContain('saved-costings-archive-rail-desktop')
        expect(styles).not.toContain('.saved-costings-archive-rail-desktop')
    })
})
