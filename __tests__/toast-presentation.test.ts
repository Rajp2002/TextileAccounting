import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

describe('toast presentation', () => {
    const toaster = read('components/ui/sonner.tsx')
    const globals = read('app/globals.css')

    it('drops toasts in at the top so they clear floating shortcuts, the tab bar and bottom sheets', () => {
        expect(toaster).toContain('position="top-center"')
        expect(toaster).toContain('closeButton')
    })

    it('pins the light theme because the app has no dark palette', () => {
        expect(toaster).toContain('theme="light"')
        expect(toaster).not.toContain('next-themes')
    })

    it('styles toasts outside any @layer so Sonner’s injected sheet cannot win', () => {
        const start = globals.indexOf('/* ── Toasts')
        const before = globals.slice(0, start)
        const section = globals.slice(start)
        // Every block opened before the section is closed, so it is top level.
        expect(before.split('{').length).toBe(before.split('}').length)
        expect(section).not.toMatch(/^@layer/m)
        expect(section).toContain('.toaster[data-sonner-toaster] [data-sonner-toast][data-styled="true"] [data-close-button]')
        // The close control sits in line, not as Sonner's floating corner badge.
        expect(section).toMatch(/\[data-close-button\] \{[^}]*position: relative;[^}]*transform: none;/)
        expect(section).toContain('[data-type="error"]')
    })

    it('keeps errors on screen longer than confirmations', () => {
        expect(read('lib/app-notifications.ts')).toContain('duration: errorDuration')
    })
})
