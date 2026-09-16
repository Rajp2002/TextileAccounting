import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { payrollTourSteps } from '../lib/payroll-tour'
import { payrollPreviewLabels } from '../lib/i18n/payroll-tutorial'

const locale = vi.hoisted(() => ({ language: 'en' as 'en' | 'gu' | 'hi' }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: locale.language, tx: (text: string) => text }) }))
vi.mock('@/components/ui/dialog', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    return { Dialog: Container, DialogContent: Container, DialogDescription: Container, DialogHeader: Container, DialogTitle: Container }
})
import PayrollTourPreview from '../components/payroll/PayrollTourPreview'

describe('Payroll sample preview targets and isolation', () => {
    for (const variant of ['base', 'full'] as const) {
        for (const track of ['core', 'help'] as const) for (const language of ['en', 'gu', 'hi'] as const) for (const step of payrollTourSteps(variant, track)) {
            it(`${variant}/${track}/${language}: ${step} has one target and no actionable business controls`, () => {
                locale.language = language
                const html = renderToStaticMarkup(<PayrollTourPreview variant={variant} step={step} />)
                expect(html.match(new RegExp(`data-payroll-tour="${step}"`, 'g'))).toHaveLength(1)
                expect(html).not.toMatch(/<(form|a)\b/)
                for (const tag of html.match(/<(button|input|select)\b[^>]*>/g) ?? []) expect(tag).toContain('disabled=""')
            })
        }
    }
    it('does not import payment actions, live data, navigation or sending integrations', () => {
        const source = fs.readFileSync('components/payroll/PayrollTourPreview.tsx', 'utf8')
        expect(source).not.toMatch(/from ['"].*(actions|supabase|next\/navigation|loaders|whatsapp)/)
        expect(source).not.toMatch(/fetch\(|window\.open|\.click\(|onSubmit=|onClick=/)
    })
    it('does not show Base-only controls in Full Suite settlement', () => {
        locale.language = 'en'
        const html = renderToStaticMarkup(<PayrollTourPreview variant="full" step="finalSettlement" />)
        expect(html).toContain('Mark as Final Settlement')
        expect(html).not.toContain('data-payroll-tour="complete"')
        expect(html).not.toContain('data-payroll-tour="paymentDetails"')
    })
    it('renders translated resolution and completion controls without legacy phrase lookup', () => {
        for (const language of ['gu', 'hi'] as const) {
            locale.language = language
            const obligations = renderToStaticMarkup(<PayrollTourPreview variant="base" step="obligations" />)
            expect(obligations).toContain(payrollPreviewLabels[language].Resolve)
            expect(obligations).toContain(payrollPreviewLabels[language]['Resolved (₹0)'])
            expect(obligations).not.toContain('>Resolve<')
            const complete = renderToStaticMarkup(<PayrollTourPreview variant="base" step="complete" />)
            expect(complete).toContain(payrollPreviewLabels[language]['Complete Payroll'])
        }
    })
    it('shows one combined Base payment form and the explicit zero-pay resolution path', () => {
        locale.language = 'en'
        const details = renderToStaticMarkup(<PayrollTourPreview variant="base" step="paymentDetails" />)
        for (const label of ['Payment method', 'Payment date', 'Note (optional)']) expect(details).toContain(label)
        const obligations = renderToStaticMarkup(<PayrollTourPreview variant="base" step="obligations" />)
        expect(obligations).toContain('Resolve')
        expect(obligations).toContain('Resolved (₹0)')
        expect(obligations).not.toContain('Mark as paid')
        const complete = renderToStaticMarkup(<PayrollTourPreview variant="base" step="complete" />)
        expect(complete).toContain('Complete Payroll')
        expect(complete).toContain('3/3')
    })
    it('keeps optional help opt-in and separate from core completion, with focus restoration', () => {
        const wrapper = fs.readFileSync('components/payroll/PayrollGuidedTour.tsx', 'utf8')
        const tutorial = fs.readFileSync('components/tours/PayrollTutorial.tsx', 'utf8')
        expect(wrapper).toContain("onClick={() => launch('help')}")
        expect(wrapper).toContain("onLaunch={() => launch('core')}")
        expect(wrapper).toContain('returnFocus.current = launcher.current?.querySelector<HTMLElement>')
        expect(wrapper).toContain("nextTrack === 'help' ? '[data-tour-control=\"payroll-help\"]'")
        expect(tutorial).toContain("if (track === 'core') void persistTourCompleted('payroll', userId)")
        expect(tutorial).toContain('const trigger = launchElement?.isConnected ?')
        expect(tutorial).toContain("event.key === 'Escape'")
        expect(tutorial).toContain('trigger?.focus({ preventScroll: true })')
    })
    it('keeps the live page mounted and saves scroll before starting', () => {
        const source = fs.readFileSync('components/payroll/PayrollGuidedTour.tsx', 'utf8')
        expect(source).toContain('<div hidden={step !== null}>{children}</div>')
        expect(source.indexOf('returnScroll.current =')).toBeLessThan(source.indexOf('setStep(payrollTourSteps'))
        expect(source).toContain('useState<PayrollTourStep | null>(null)')
    })
})
