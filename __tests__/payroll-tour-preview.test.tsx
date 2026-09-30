import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { payrollTourSteps, payrollTourSelector } from '../lib/payroll-tour'
import { payrollPreviewLabels } from '../lib/i18n/payroll-tutorial'

const locale = vi.hoisted(() => ({ language: 'en' as 'en' | 'gu' | 'hi' }))
vi.mock('@/lib/i18n/context', async () => {
    const dictionaries = { en: (await import('../lib/i18n/locales/en')).en, gu: (await import('../lib/i18n/locales/gu')).gu, hi: (await import('../lib/i18n/locales/hi')).hi }
    return { useTranslation: () => ({ language: locale.language, t: (key: string) => {
        let value: unknown = dictionaries[locale.language]
        for (const part of key.split('.')) value = (value as Record<string, unknown>)[part]
        if (typeof value !== 'string') throw new Error(`Unresolved translation: ${key}`)
        return value
    } }) }
})
vi.mock('@/components/ui/dialog', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    return { Dialog: Container, DialogContent: Container, DialogDescription: Container, DialogHeader: Container, DialogTitle: Container }
})
import PayrollTourPreview from '../components/payroll/PayrollTourPreview'

describe('Payroll replica targets and isolation', () => {
    for (const track of ['core', 'help'] as const) for (const language of ['en', 'gu', 'hi'] as const) for (const step of payrollTourSteps(track)) {
        it(`${track}/${language}: ${step} has the specified target and disabled business controls`, () => {
            locale.language = language
            const html = renderToStaticMarkup(<PayrollTourPreview step={step} />)
            if (step.endsWith('handoff')) { expect(html).toBe(''); return }
            const attribute = payrollTourSelector(step).slice(1, -1)
            expect(html.split(attribute)).toHaveLength(2)
            expect(html).not.toMatch(/<(form|a)\b/)
            for (const tag of html.match(/<(button|input|select)\b[^>]*>/g) ?? []) expect(tag).toContain('disabled=""')
        })
    }
    it('has no actions, persistence, draft, navigation, export or messaging paths', () => {
        const source = fs.readFileSync('components/payroll/PayrollTourPreview.tsx', 'utf8')
        expect(source).not.toMatch(/from ['"].*(actions|supabase|next\/navigation|loaders|whatsapp)/)
        expect(source).not.toMatch(/fetch\(|window\.open|\.click\(|onSubmit=|onClick=|localStorage|sessionStorage|translatePage|\btx\(/)
    })
    it('shows method and note without the unsaved payment date and keeps zero-pay resolution separate', () => {
        locale.language = 'en'
        const details = renderToStaticMarkup(<PayrollTourPreview step="pr-paid" />)
        for (const label of ['Payment method', 'Note (optional)', 'Confirm Payment']) expect(details).toContain(label)
        expect(details).not.toContain('Payment date')
        const settlement = renderToStaticMarkup(<PayrollTourPreview step="pr-settle" />)
        expect(settlement).toContain('Resolve')
        expect(settlement).toContain('Mark Paid')
        expect(settlement).toContain('Sample worker · no earnings')
        const complete = renderToStaticMarkup(<PayrollTourPreview step="pr-complete" />)
        expect(complete).toContain('Complete Payroll')
        expect(complete).toContain('3/3')
    })
    it('matches worker gross lines, chevrons and the current settlement label', () => {
        locale.language = 'en'
        const earnings = renderToStaticMarkup(<PayrollTourPreview step="pr-earnings" />)
        expect(earnings).toContain('Gross earnings')
        expect(earnings).not.toContain('×')
        expect(earnings).not.toContain('Payment date')
        const period = renderToStaticMarkup(<PayrollTourPreview step="pr-period" settlementLabel="View settled payroll" />)
        expect(period).toContain('View settled payroll')
        expect(period).toContain('lucide-chevron-left')
        expect(period).not.toContain('>Previous<')
    })
    it('renders keyed native controls and the records/reversal surfaces without fallback', () => {
        for (const language of ['gu', 'hi'] as const) {
            locale.language = language
            const complete = renderToStaticMarkup(<PayrollTourPreview step="pr-complete" />)
            expect(complete).not.toContain('Complete Payroll')
            const correction = renderToStaticMarkup(<PayrollTourPreview step="pra-correct" />)
            expect(correction).toContain(payrollPreviewLabels[language]['Record reversal'])
            const records = renderToStaticMarkup(<PayrollTourPreview step="pra-records" />)
            expect(records).toContain(payrollPreviewLabels[language].Workers)
            expect(records).toContain(payrollPreviewLabels[language].Machines)
        }
    })
    it('uses the replica shell and shared runtime while the optional walkthrough records nothing', () => {
        const wrapper = fs.readFileSync('components/payroll/PayrollGuidedTour.tsx', 'utf8')
        const shell = fs.readFileSync('components/tours/ReplicaGuidedTour.tsx', 'utf8')
        expect(wrapper).toContain('<ReplicaGuidedTour tourId="payroll"')
        expect(wrapper).toContain('handoffStepId="pr-handoff"')
        expect(wrapper).toContain('workspaceClassName="payroll-workspace-shell')
        expect(wrapper).toContain('recordCompletion={false}')
        expect(wrapper).not.toMatch(/persistTour|recordTourEvent|router\.refresh/)
        expect(wrapper).toContain('data-tour-control="payroll-help"')
        expect(wrapper).toContain("<div hidden={extraStep !== null && extraStep !== 'pra-handoff'}>{children}</div>")
        expect(wrapper).toContain('launcher={extraLauncher}')
        expect(wrapper).toContain('window.scrollTo(')
        expect(shell).toContain('<div hidden={step !== null && step !== handoffStepId}>{children}</div>')
        expect(wrapper).toContain('copy.calculation.title')
        expect(wrapper).toContain('copy.calculation.description')
    })
})
