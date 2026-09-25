import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Settings responsive layout', () => {
    it('keeps Settings centred in the dashboard content column at every width', () => {
        const styles = read('app/globals.css')
        expect(styles).toMatch(/\.settings-page-frame \{\s*width: 100%;/)
        // The main column already starts after the sidebar; a second guard
        // pushed Settings off-centre once the document was no longer zoomed.
        expect(styles).not.toContain('--settings-sidebar-guard')
        expect(styles).not.toContain('--settings-frame-width')
    })
})
