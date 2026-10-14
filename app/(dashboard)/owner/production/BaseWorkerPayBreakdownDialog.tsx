'use client'

import type { ReactNode } from 'react'
import { CheckCircle2, Clock3 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { formatINR } from '@/lib/finance'
import { useTranslation } from '@/lib/i18n/context'
import type { tourSurfaceProps } from '@/lib/tours/sample-surface'
import type {
    BasePayrollPaymentMode,
    BaseProductionWorker,
    BaseWorkerMachineBreakdown,
    BaseWorkerPayable,
} from '@/lib/base-production-core'
import BaseStaffAttendanceCalendar from './BaseStaffAttendanceCalendar'

function formatDateOnly(value: string | null | undefined) {
    if (!value) return '—'
    const [year, month, day] = value.slice(0, 10).split('-').map(Number)
    if (![year, month, day].every(Number.isFinite)) return value
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    }).format(new Date(Date.UTC(year, month - 1, day)))
}

/** "1 Oct – 14 Oct 2026", with the year once when both dates share it. */
function formatPeriod(start: string, end: string) {
    const startLabel = formatDateOnly(start)
    const endLabel = formatDateOnly(end)
    if (start.slice(0, 4) !== end.slice(0, 4)) return `${startLabel} – ${endLabel}`
    return `${startLabel.replace(/\s\d{4}$/, '')} – ${endLabel}`
}

function formatMeters(value: number) {
    return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)} m`
}

function paymentModeLabel(mode: BasePayrollPaymentMode | null | undefined) {
    if (mode === 'bank_transfer') return 'Bank transfer'
    if (mode === 'upi') return 'UPI'
    if (mode === 'cheque') return 'Cheque'
    if (mode === 'cash') return 'Cash'
    return null
}

const headCell = 'whitespace-nowrap pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'
const numberCell = 'whitespace-nowrap pl-3 text-right'

/**
 * One worker's pay for the period on a single screen: net pay and how it is reached on the
 * right (on phones, first), and what earned it on the left: metres by machine for piece-rate
 * workers, the attendance calendar for fixed-salary staff.
 */
export default function BaseWorkerPayBreakdownDialog({
    payable,
    worker,
    breakdown,
    onClose,
    surface,
    pendingDayOffDates,
    dayOffError,
    onToggleDayOff,
}: {
    payable: BaseWorkerPayable | null
    worker?: BaseProductionWorker
    breakdown: BaseWorkerMachineBreakdown | null
    onClose: () => void
    surface: ReturnType<typeof tourSurfaceProps>
    pendingDayOffDates?: ReadonlySet<string>
    dayOffError?: string | null
    /** Omit to show the attendance calendar read-only, for example in a tour sample. */
    onToggleDayOff?: (date: string, off: boolean) => void
}) {
    const { tx } = useTranslation()

    return (
        <Dialog open={Boolean(payable)} onOpenChange={(open) => !open && onClose()} {...surface.root}>
            <DialogContent className="gap-5 rounded-2xl border border-hairline bg-surface sm:max-w-4xl" {...surface.content}>
                {payable && (
                    <>
                        <DialogHeader className="gap-1.5 pr-10">
                            <DialogTitle className="text-xl font-bold text-ink" data-i18n-skip="true">{payable.worker_name}</DialogTitle>
                            {/* Each part stays whole, so a narrow screen breaks the line only after a dot. */}
                            <DialogDescription className="text-sm text-body">
                                {[formatPeriod(payable.period_start, payable.period_end), ...workerLine(payable, worker, tx)]
                                    .map(part => part.replace(/ /g, '\u00a0'))
                                    .join('\u00a0· ')}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_18rem] md:gap-6">
                            <PaySummary payable={payable} />
                            <div className="min-w-0 space-y-5 md:col-start-1 md:row-start-1">
                                {payable.pay_type === 'fixed_monthly' ? (
                                    <section className="space-y-3">
                                        <SectionTitle>{tx('Days worked')}</SectionTitle>
                                        <BaseStaffAttendanceCalendar
                                            lines={payable.salary_lines ?? []}
                                            locked={payable.status === 'paid'}
                                            pendingDates={pendingDayOffDates}
                                            error={dayOffError}
                                            onToggle={onToggleDayOff}
                                        />
                                    </section>
                                ) : <MachineTable breakdown={breakdown} />}
                                {payable.incentive_lines?.length ? <IncentiveList payable={payable} /> : null}
                            </div>
                        </div>

                        <DialogFooter className="border-t border-hairline pt-4">
                            <Button variant="outline" onClick={onClose} className="h-10 rounded-xl border-hairline font-semibold hover:bg-surface-soft">{tx('Close')}</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}

function workerLine(payable: BaseWorkerPayable, worker: BaseProductionWorker | undefined, tx: (text: string) => string) {
    const inactive = worker && !worker.is_active ? [tx('Inactive')] : []
    if (payable.pay_type === 'fixed_monthly') return [worker?.role || tx('Staff'), tx('Fixed monthly salary'), ...inactive]
    const shift = worker?.shift_availability === 'both' ? tx('Day & night shift')
        : worker?.shift_availability === 'day' ? tx('Day shift')
            : worker?.shift_availability === 'night' ? tx('Night shift')
                : null
    return [...(shift ? [shift] : []), tx('Piece rate'), ...inactive]
}

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{children}</h3>
            {aside && <p className="text-xs text-muted-foreground">{aside}</p>}
        </div>
    )
}

function PaySummary({ payable }: { payable: BaseWorkerPayable }) {
    const { tx } = useTranslation()
    const incentivePay = payable.incentive_pay ?? 0
    const basePay = payable.base_pay ?? payable.gross_pay - incentivePay
    const mode = paymentModeLabel(payable.payment_mode)
    const carryForward = payable.remaining_debt > 0
        ? tx('{amount} carries forward to the next period.', { amount: formatINR(payable.remaining_debt) })
        : ''
    const note = payable.status === 'paid'
        ? carryForward
        : payable.pending_advance > 0
            ? `${tx('{amount} pending in advances and deductions.', { amount: formatINR(payable.pending_advance) })} ${carryForward}`.trim()
            : tx('No advance to recover.')
    const status = payable.status === 'paid'
        ? `${tx('Paid on {date}', { date: formatDateOnly(payable.paid_at) })}${mode ? ` · ${tx(mode)}` : ''}`
        : tx('Not paid yet')

    return (
        <section aria-label={tx('Net pay')} className="rounded-xl border border-hairline bg-surface-soft/60 p-4 sm:p-5 md:col-start-2 md:row-start-1 md:self-start">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tx('Net pay')}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-ink tabular-nums">{formatINR(payable.net_payout)}</p>
            <p className={`mt-1.5 flex items-center gap-1.5 text-xs font-semibold ${payable.status === 'paid' ? 'text-success' : 'text-body'}`}>
                {payable.status === 'paid' ? <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0" /> : <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />}
                {status}
            </p>

            <dl className="mt-4 space-y-2.5 border-t border-hairline-strong/60 pt-4 text-sm tabular-nums">
                {incentivePay > 0 && <>
                    <SummaryRow label={payable.pay_type === 'fixed_monthly' ? tx('Salary') : tx('Machine pay')} value={formatINR(basePay)} />
                    <SummaryRow label={tx('Approved incentives')} value={`+ ${formatINR(incentivePay)}`} />
                </>}
                <SummaryRow label={tx('Gross pay')} value={formatINR(payable.gross_pay)} strong />
                <SummaryRow label={tx('Advance recovery')} value={payable.advance_recovery > 0 ? `− ${formatINR(payable.advance_recovery)}` : formatINR(0)} />
            </dl>

            {note && <p className="mt-3 text-xs leading-relaxed text-body">{note}</p>}
        </section>
    )
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <dt className={strong ? 'font-semibold text-ink' : 'text-body'}>{label}</dt>
            <dd className={`text-right ${strong ? 'font-bold text-ink' : 'font-medium text-ink'}`}>{value}</dd>
        </div>
    )
}

function MachineTable({ breakdown }: { breakdown: BaseWorkerMachineBreakdown | null }) {
    const { tx } = useTranslation()
    const rows = breakdown?.rows ?? []
    const machineCount = rows.filter(row => row.machine_label).length

    return (
        <section>
            <SectionTitle aside={machineCount > 0 ? (machineCount === 1 ? tx('1 machine') : tx('{count} machines', { count: machineCount })) : undefined}>{tx('Metres by machine')}</SectionTitle>
            {breakdown && rows.length ? (
                <table className="mt-3 w-full text-sm tabular-nums">
                    <thead>
                        <tr className="border-b border-hairline">
                            <th scope="col" className={`${headCell} text-left`}>{tx('Machine')}</th>
                            <th scope="col" className={`${headCell} pl-3 text-right`}>{tx('Metres')}</th>
                            <th scope="col" className={`${headCell} hidden pl-3 text-right sm:table-cell`}>{tx('Rate')}</th>
                            <th scope="col" className={`${headCell} pl-3 text-right`}>{tx('Pay')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                        {rows.map(row => {
                            const share = breakdown.meters > 0 ? Math.round((row.meters / breakdown.meters) * 100) : 0
                            return (
                                <tr key={`${row.machine_label}-${row.rate_per_meter}`} className="align-top">
                                    <td className="py-3">
                                        {/* Machine names are the owner's own labels; the page translator must not touch them. */}
                                        <span className="block font-semibold text-ink" data-i18n-skip="true">{row.machine_label || tx('Worker total (machine not recorded)')}</span>
                                        <span className="mt-2 flex items-center gap-2">
                                            <span aria-hidden="true" className="block h-1.5 w-full max-w-36 overflow-hidden rounded-full bg-surface-muted/80">
                                                <span className="block h-full rounded-full bg-loom" style={{ width: `${share}%` }} />
                                            </span>
                                            <span className="text-[11px] font-medium text-muted-foreground">{share}%</span>
                                        </span>
                                    </td>
                                    <td className={`${numberCell} py-3 text-ink`}>
                                        {formatMeters(row.meters)}
                                        <span className="mt-1 block text-xs text-muted-foreground sm:hidden">× {formatINR(row.rate_per_meter)}/m</span>
                                    </td>
                                    <td className={`${numberCell} hidden py-3 text-body sm:table-cell`}>{formatINR(row.rate_per_meter)}/m</td>
                                    <td className={`${numberCell} py-3 font-semibold text-ink`}>{formatINR(row.pay)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="border-t border-hairline-strong font-bold text-ink">
                            <th scope="row" className="pt-3 text-left">{tx('Total')}</th>
                            <td className={`${numberCell} pt-3`}>{formatMeters(breakdown.meters)}</td>
                            <td className="hidden pt-3 sm:table-cell" />
                            <td className={`${numberCell} pt-3`}>{formatINR(breakdown.pay)}</td>
                        </tr>
                    </tfoot>
                </table>
            ) : (
                <p className="mt-3 rounded-xl border border-dashed border-hairline bg-surface-soft/40 p-4 text-sm text-body">{tx('No metres recorded in this period.')}</p>
            )}
        </section>
    )
}

function IncentiveList({ payable }: { payable: BaseWorkerPayable }) {
    const { tx } = useTranslation()
    return (
        <section>
            <SectionTitle>{tx('Approved incentives')}</SectionTitle>
            <ul className="mt-2 divide-y divide-hairline text-sm tabular-nums">
                {payable.incentive_lines?.map(line => (
                    <li key={line.id} className="flex items-baseline justify-between gap-3 py-2.5">
                        <span className="min-w-0">
                            <span className="block text-ink">{formatPeriod(line.service_start, line.service_end)}</span>
                            {line.evidence_reference && <span className="block truncate text-xs text-muted-foreground" data-i18n-skip="true">{line.evidence_reference}</span>}
                        </span>
                        <span className="shrink-0 font-semibold text-ink">{formatINR(line.amount)}</span>
                    </li>
                ))}
            </ul>
        </section>
    )
}
