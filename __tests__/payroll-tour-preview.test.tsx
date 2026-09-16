import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { payrollTourSteps } from '../lib/payroll-tour'

vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: 'en', tx: (text: string) => text }) }))
vi.mock('@/components/ui/dialog', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    return { Dialog: Container, DialogContent: Container, DialogDescription: Container, DialogHeader: Container, DialogTitle: Container }
})
import PayrollTourPreview from '../components/payroll/PayrollTourPreview'

describe('Payroll sample preview targets and isolation', () => {
    for (const variant of ['base', 'full'] as const) {
        for (const step of payrollTourSteps(variant)) {
            it(`${variant}: ${step} has one target and no actionable business controls`, () => {
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
        const html = renderToStaticMarkup(<PayrollTourPreview variant="full" step="confirm" />)
        expect(html).toContain('Mark as Final Settlement')
        expect(html).not.toContain('data-payroll-tour="complete"')
        expect(html).not.toContain('data-payroll-tour="paymentDate"')
    })
    it('keeps the live page mounted and saves scroll before starting', () => {
        const source = fs.readFileSync('components/payroll/PayrollGuidedTour.tsx', 'utf8')
        expect(source).toContain('<div hidden={step !== null}>{children}</div>')
        expect(source.indexOf('returnScroll.current =')).toBeLessThan(source.indexOf('setStep(payrollTourSteps'))
        expect(source).toContain('useState<PayrollTourStep | null>(null)')
    })
})
