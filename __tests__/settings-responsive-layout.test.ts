import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Settings responsive layout', () => {
    it('keeps the estimator rail inside the dashboard content width', () => {
        const styles = read('app/globals.css')
        expect(styles).toContain('@media (min-width: 1700px)')
        expect(styles).toMatch(/@media \(min-width: 1700px\)[\s\S]*?\.settings-page-frame \{[\s\S]*?width: 100%;[\s\S]*?margin-left: 0;/)
        expect(styles).not.toContain('--settings-frame-width')
    })
})
