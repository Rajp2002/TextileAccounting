import React, { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { TourPanel } from '../components/tours/TourPanel'
import { TourSpotlight } from '../components/tours/TourSpotlight'
import { tourCommonCopy } from '../lib/i18n/tour-common'

const props = { tourId: 'configuration', stepId: 'first', title: 'A useful outcome', body: 'A short explanation.', index: 0, total: 6, sample: false, status: 'ready' as const, isLast: false, onExit: vi.fn(), onBack: vi.fn(), onNext: vi.fn(), panelRef: createRef<HTMLDivElement>() }
describe('shared panel anatomy', () => {
    it('renders accessible identifiers, a live region, progress text and usable navigation', () => {
        const html = renderToStaticMarkup(<TourPanel {...props} />)
        expect(html).toContain('role="dialog"'); expect(html).toContain('aria-modal="true"')
        expect(html).toContain('data-testid="guided-tour-panel"'); expect(html).toContain('data-tour-id="configuration"')
        expect(html).toContain('data-tour-step="first"'); expect(html).toContain('data-tour-status="ready"')
        expect(html).toContain('Step 1 of 6'); expect(html).not.toContain('Sample ·')
        expect(html).not.toContain('data-tour-control="back"'); expect(html).not.toContain('role="progressbar"')
        for (const attribute of ['aria-labelledby', 'aria-describedby']) {
            const id = html.match(new RegExp(`${attribute}="([^"]+)"`))?.[1]
            expect(id).toBeTruthy(); expect(html).toContain(`id="${id}"`)
        }
        expect(html).toContain('aria-live="polite"')
    })
    it.each(['en', 'gu', 'hi'] as const)('renders sample, Back, Done, collapsed detail and extra in %s', language => {
        const html = renderToStaticMarkup(<TourPanel {...props} language={language} index={5} sample isLast detail="Extra explanation" extra={<div data-extra>Choice</div>} />)
        expect(html).toContain(`${tourCommonCopy[language].sample} ·`)
        expect(html).toContain('data-tour-control="back"'); expect(html).toContain(tourCommonCopy[language].done)
        expect(html).toContain('data-tour-control="next"'); expect(html).toContain('aria-expanded="false"')
        expect(html).toMatch(/<p[^>]*hidden=""[^>]*>Extra explanation/)
        expect(html.indexOf('data-extra')).toBeLessThan(html.indexOf('data-tour-control="more"'))
    })
    it('keeps Next and Back usable while preparing or unavailable', () => {
        for (const status of ['preparing', 'unavailable'] as const) {
            const html = renderToStaticMarkup(<TourPanel {...props} index={1} status={status} statusText="Status" />)
            expect(html).toContain('role="status"'); expect(html).not.toMatch(/<button[^>]* disabled=/)
        }
    })
    it('uses a six-pixel cutout and a plain two-pixel outline without blur or glow', () => {
        const html = renderToStaticMarkup(<TourSpotlight rect={{ left: 100, top: 200, right: 300, bottom: 240, width: 200, height: 40 }} animate />)
        expect(html).toContain('94px 194px'); expect(html).toContain('width:212px;height:52px')
        expect(html).toContain('border-2 border-saffron'); expect(html).not.toMatch(/backdrop-blur|ring-4|shadow/)
        const unavailable = renderToStaticMarkup(<TourSpotlight rect={null} animate={false} />)
        expect(unavailable).not.toContain('guided-tour-highlight'); expect(unavailable).not.toContain('clip-path')
    })
})
