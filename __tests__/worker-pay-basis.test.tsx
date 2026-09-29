import React from 'react'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { workersTutorialCopy } from '../lib/i18n/workers-tutorial'
import { makeWorkersTourExamples } from '../lib/workers-tour'

const locale = vi.hoisted(() => ({ language: 'en' as 'en' | 'gu' | 'hi' }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: locale.language, tx: (text: string) => text, t: (key: string) => ({ en, gu, hi }[locale.language].workers[key.split('.')[1] as keyof typeof en.workers] as string) }) }))
vi.mock('@/components/navigation/navigation-link', () => ({ NavigationLink: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a> }))
import { WorkerPayBasis } from '../components/workers/WorkerPayBasis'
import { WorkerCard } from '../components/workers/WorkerCard'

beforeEach(() => { locale.language = 'en' })
describe('Base worker wage-source display', () => {
    it.each([0, 99])('does not claim rate readiness from the legacy worker rate %s', rate => {
        const worker = { ...makeWorkersTourExamples()[0], rate_per_meter: rate }
        const html = renderToStaticMarkup(<WorkerCard worker={worker} onEdit={() => {}} />)
        expect(html).toContain('Wage source')
        expect(html).toContain('Production quality')
        expect(html).not.toContain('Rate setup')
        expect(html).not.toContain('Not configured')
        expect(html).not.toContain('₹99')
    })
    it('uses the loom quality rate for piece-rate operators, including a zero quality wage', () => {
        for (const rate of [0, 1.5]) {
            const html = renderToStaticMarkup(<WorkerPayBasis worker={{ pay_type: 'piece_rate' }} quality={{ worker_rate_per_meter: rate }} />)
            expect(html).toContain(`Quality weaver wage: ₹${rate}/m`)
        }
    })
    it('keeps fixed salary private and does not present the loom wage as salary pay', () => {
        const html = renderToStaticMarkup(<WorkerPayBasis worker={{ pay_type: 'fixed_monthly' }} quality={{ worker_rate_per_meter: 1.5 }} />)
        expect(html).toContain('Fixed monthly salary')
        expect(html).not.toContain('₹')
    })
    it('localizes the source and pay-type display in all supported languages', () => {
        for (const language of ['en', 'gu', 'hi'] as const) {
            locale.language = language
            expect(renderToStaticMarkup(<WorkerPayBasis worker={{ pay_type: 'piece_rate' }} />)).toContain(workersTutorialCopy[language].wageSource)
            expect(renderToStaticMarkup(<WorkerPayBasis worker={{ pay_type: 'fixed_monthly' }} />)).toContain(workersTutorialCopy[language].salaryBasis)
        }
    })
    it('uses the shared pay source for current and available operators in Manage Workers', () => {
        const source = readFileSync('app/(dashboard)/owner/production/BaseMachineBoard.tsx', 'utf8')
        expect(source).not.toMatch(/(?:currentWorker|worker)\.rate_per_meter/)
        expect(source).toContain('<WorkerPayBasis worker={currentWorker} quality={currentJobByMachine.get(managingMachine.id)}')
        expect(source).toContain('<WorkerPayBasis worker={worker} quality={managingMachine ? currentJobByMachine.get(managingMachine.id) : undefined}')
    })
})
