import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Source contract for the owner active-time tracker (spec 2026-10-30 section A).
const read = (path: string) => readFileSync(path, 'utf8')

describe('activity tracker mounts', () => {
    it.each(['app/(dashboard)/owner/layout.tsx', 'app/free/layout.tsx', 'app/(support)/support/layout.tsx', 'app/(plan-selection)/plans/page.tsx'])('%s mounts the tracker', file => {
        expect(read(file)).toContain('<ActivityTracker')
    })

    it('the founder console never mounts it', () => {
        expect(read('app/(admin-console)/admin/layout.tsx')).not.toContain('ActivityTracker')
    })
})

describe('activity tracker component', () => {
    it('sends only the counter flush, never content, storage or Sentry', () => {
        const src = read('components/analytics/ActivityTracker.tsx')
        expect(src).toContain("'use client'")
        expect(src).toContain('/api/analytics/activity')
        expect(src).toContain('sendBeacon')
        expect(src).toContain('keepalive: true')
        expect(src).toContain('counter.resume(Date.now())')
        expect(src).toContain('counter.poll(')
        for (const banned of ['localStorage', 'sessionStorage', '@sentry', 'location.href', 'location.search', 'navigator.userAgent', 'innerText', 'textContent', 'FormData', '.target']) {
            expect(src).not.toContain(banned)
        }
    })
})

describe('privacy policy', () => {
    it('discloses active time and last seen', () => {
        expect(read('app/privacy/page.tsx')).toContain('Active time in the app')
    })
})
