'use client'

import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { payrollPreviewLabels, payrollTutorialCopy } from '@/lib/i18n/payroll-tutorial'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { formatPayrollTourDate, makePayrollTourExample, payrollTourSelector, payrollTourSurface, type PayrollTourStep } from '@/lib/payroll-tour'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/** Disabled display-only replicas: no business, navigation, draft or export handlers. */
export default function PayrollTourPreview({ step, settlementLabel }: { step: PayrollTourStep; settlementLabel?: string }) {
    const { language, t } = useTranslation()
    if (step === 'pr-handoff' || step === 'pra-handoff') return null
    const label = (text: string) => {
        const value = payrollPreviewLabels[language][text]
        if (!value) throw new Error(`Missing Payroll preview label: ${text}`)
        return value
    }
    const copy = payrollTutorialCopy[language]
    const sample = makePayrollTourExample()
    const surface = payrollTourSurface(step)
    const period = `${formatPayrollTourDate(sample.periodStart, language)} – ${formatPayrollTourDate(sample.periodEnd, language)}`
    const money = (amount: number) => new Intl.NumberFormat(`${language}-IN`, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
    const field = (name: string, value: string) => <label className="block space-y-1 text-sm font-medium">{label(name)}<Input disabled value={value} readOnly /></label>
    const action = (key: string) => <Button type="button" disabled variant="outline">{t(`payroll.${key}`)}</Button>
    const previewAction = (name: string) => <Button type="button" disabled variant="outline">{label(name)}</Button>
    const calculation = <dl className="grid grid-cols-2 gap-3 text-sm">
        <dt>{label('Gross earnings')}</dt><dd>{money(sample.piece.gross)}</dd>
        <dt>{label('Advance recovery')}</dt><dd>{money(sample.piece.recovery)}</dd>
        <dt>{label('Net amount payable')}</dt><dd>{money(sample.piece.net)}</dd>
        <dt>{label('Balance carried')}</dt><dd>{money(sample.piece.carry)}</dd>
    </dl>
    const periodSelector = <div className="flex items-center gap-2">
        <Button disabled variant="ghost" aria-label={t('common.previous_field')}><ChevronLeft aria-hidden="true" /></Button>
        <strong className="min-w-0 flex-1 text-center">{period}</strong>
        <Button disabled variant="ghost" aria-label={t('common.next_field')}><ChevronRight aria-hidden="true" /></Button>
    </div>
    const content: Partial<Record<PayrollTourStep, ReactNode>> = {
        'pr-period': <>{periodSelector}<p>{label('In Progress')} · 1/3</p><p>{label('Remaining to settle')}: {money(sample.remaining)}</p><Button disabled>{settlementLabel ?? t('payroll.continueSettlement')}</Button></>,
        'pr-readiness': <><h2 className="font-semibold">{label('Payroll readiness')}</h2><p>{copy.people.review} · {label('Review required')}</p>{action('reviewBeforePaying')}</>,
        'pr-earnings': <div className="grid gap-4 sm:grid-cols-2">
            <section className="space-y-2"><h2 className="font-semibold">{copy.people.piece}</h2><p>{period}</p><dl><dt>{t('dailySheet.metres')}</dt><dd>1,000</dd><dt>{label('Gross earnings')}</dt><dd>{money(sample.piece.gross)}</dd></dl></section>
            <section className="space-y-2"><h2 className="font-semibold">{copy.people.salary}</h2><p>{label('Fixed monthly salary')}</p><p>{period}</p><dl><dt>{label('Gross earnings')}</dt><dd>{money(sample.salary.gross)}</dd></dl></section>
        </div>,
        'pr-recovery': <><h2 className="font-semibold">{label('Advance recovery')}</h2><p>{t('payroll.metrics.outstanding')}: {money(sample.piece.debt)}</p><p>50% × {money(sample.piece.gross)} = {money(sample.piece.recovery)}</p>{calculation}</>,
        'pr-settle': <><h2 className="font-semibold">{t('payroll.settlePayroll')}</h2>
            <div className="flex flex-wrap items-center justify-between gap-3"><span>{copy.people.piece} · {money(sample.piece.net)}</span>{action('markPaid')}</div>
            <div className="flex flex-wrap items-center justify-between gap-3"><span>{copy.people.salary} · {money(sample.salary.net)}</span>{t('payroll.status.paid')}</div>
            <div className="flex flex-wrap items-center justify-between gap-3"><span>{copy.people.zero} · {money(sample.zero.net)}</span>{action('resolve')}</div>
        </>,
        'pr-paid': <><p>{copy.people.piece} · {money(sample.piece.net)}</p>{field('Payment method', t('payroll.payment.cash'))}{field('Note (optional)', '')}{action('confirmPayment')}</>,
        'pr-complete': <><h2 className="font-semibold">{label('Ready to Complete')}</h2><p>{label('All worker obligations resolved')} · 3/3</p><p>{copy.people.zero} · {label('Resolved (₹0)')}</p><p>{label('Remaining to settle')}: {money(0)}</p>{action('completePayroll')}</>,
        'pra-advance': <>{action('addAdvance')}{field('Worker', copy.people.piece)}{field('Amount', '500')}{field('Description', '')}{previewAction('Record advance')}</>,
        'pra-deduction': <>{action('addDeduction')}{field('Worker', copy.people.piece)}{field('Reason / Category', '')}{field('Amount', '500')}{field('Note (optional)', '')}{previewAction('Record deduction')}</>,
        'pra-records': <><h2 className="font-semibold">{t('payroll.payrollRecords')}</h2>{field('Pay period', period)}<div className="flex gap-3">{previewAction('Workers')}{previewAction('Machines')}</div><p>{copy.people.piece} · {t('navigation.machines')} 1</p>{calculation}</>,
        'pra-export': <><p>{period}</p><div className="flex flex-wrap gap-2">{action('exportCsv')}{action('exportPdf')}</div></>,
        'pra-correct': <>{field('Reason for reversal', '')}<label className="flex gap-2 text-sm"><input type="checkbox" disabled />{label('I confirm this payment was not actually made.')}</label>{previewAction('Record reversal')}</>,
    }
    const anchor = payrollTourSelector(step).match(/="([^"]+)"/)![1]
    const target = <section data-payroll-tour={anchor} className="space-y-4 rounded-xl border border-hairline bg-surface p-4">{content[step]}</section>
    const title = step === 'pr-paid' ? t('payroll.markPaid') : surface === 'settlement' ? t('payroll.settlePayroll') : surface === 'advance' ? label('Record worker advance') : surface === 'deduction' ? label('Record worker deduction') : label('Reverse a mistaken payment record?')
    return <div className="mx-auto max-w-6xl space-y-5" data-i18n-skip="true" lang={language}>
        <header><h1 className="text-2xl font-bold">{label('Payroll')}</h1><p className="mt-1 text-xs font-semibold">{tourCommonCopy[language].sampleBanner}</p></header>
        {surface !== 'page' ? <>
            <div className="rounded-xl border border-hairline bg-surface p-4">{period} · {copy.people.piece}</div>
            <Dialog open modal={false}><DialogContent data-payroll-tour-preview="true" data-tour-sample-dialog="payroll" data-i18n-skip="true" lang={language}
                className="max-h-[calc(100dvh-2rem)] overflow-y-auto" showCloseButton={false} hideOverlay
                onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}
                onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => event.preventDefault()}>
                <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{tourCommonCopy[language].sampleBanner}</DialogDescription></DialogHeader>{target}
            </DialogContent></Dialog>
        </> : target}
    </div>
}
