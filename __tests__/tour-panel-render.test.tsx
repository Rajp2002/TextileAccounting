import { renderToStaticMarkup } from 'react-dom/server'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { TourPanel } from '../components/tours/TourPanel'
describe('TourPanel', () => { it('renders its accessible first-step anatomy', () => { const html = renderToStaticMarkup(<TourPanel tourId="machines" stepId="intro" title="Set up a loom" body="Start here." detail="Extra." index={0} total={2} sample status="ready" isLast={false} onExit={() => {}} onBack={() => {}} onNext={() => {}} panelRef={createRef()} />); expect(html).toContain('role="dialog"'); expect(html).toContain('Sample · Step 1 of 2'); expect(html).toContain('aria-expanded="false"'); expect(html).not.toContain('data-tour-control="back"'); expect(html).toContain('data-tour-status="ready"') }) })
