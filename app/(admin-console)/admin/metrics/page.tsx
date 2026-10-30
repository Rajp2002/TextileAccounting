import Link from 'next/link'
import { getMetricsReport, type MetricList, type MetricsReport } from '@/lib/admin/growth'
import { financialYear, financialYearFromLabel, financialYearMonths } from '@/lib/admin/fiscal'
import { ACTIVITY_AREAS } from '@/lib/activity-tracking'
import { ReportHeader, ReportSurface, SourceUnavailable } from '@/components/admin/report-ui'
import { BarList, MetricTile, NotYet, RateText, formatRupees } from '@/components/admin/metrics-ui'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata = { title: 'Metrics' }

const AREA_LABELS: Record<typeof ACTIVITY_AREAS[number], string> = {
    estimator: 'Estimator', saved_costings: 'Saved costings', rate_book: 'Rate book', plan_billing: 'Plan and billing', settings: 'Settings', support: 'Support', other: 'Other',
}
const PLAN_LABELS = { free: 'Free', lite_trial: 'Lite trial', lite_paid: 'Lite paid', base: 'Base', none: 'No access' } as const
const monthName = (month: string) => new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
const dayName = (day: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
const fyKey = (label: string) => `fy-${label.replace('–', '-')}`

function Section({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
    return <section className="border-t border-hairline p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {note && <p className="mt-1 text-xs text-subtle">{note}</p>}
        <div className="mt-4 space-y-5">{children}</div>
    </section>
}

export default async function MetricsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams
    const query = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]))
    let report: MetricsReport
    try { report = await getMetricsReport(query) }
    catch { return <><ReportHeader title="Metrics">Plans, money, usage and customers who have gone quiet.</ReportHeader><SourceUnavailable title="Metrics couldn't be loaded">Nothing has changed. Try again in a minute.</SourceUnavailable></> }

    const list = (name: MetricList) => `/admin/metrics/accounts?list=${name}&period=${report.periodKey}`
    const live = report.goLiveAt !== null
    const selectedFy = report.period.kind === 'fy' ? report.period.fy : financialYear(`${report.period.month}-15T00:00:00+05:30`).label
    const thisFy = financialYear(report.asOf).label
    const lastFy = financialYear(new Date(Date.parse(financialYearFromLabel(thisFy)!.start) - 86_400_000).toISOString()).label
    const since = report.trackingSince ? `Since ${dayName(report.trackingSince)}` : 'Not recorded yet'
    const plans = report.plans, totalAccounts = Object.values(plans).reduce((sum, ids) => sum + ids.length, 0)
    const periodLabel = report.period.kind === 'fy' ? `FY ${report.period.fy}` : `${monthName(report.period.month)} ${report.period.month.slice(0, 4)}`
    const linkClass = (active: boolean) => `inline-flex min-h-11 items-center rounded-lg px-3 text-sm ${active ? 'bg-ink font-medium text-surface' : 'text-ink underline-offset-4 hover:underline'}`

    return <>
        <ReportHeader title="Metrics">Plans, money, usage and customers who have gone quiet. Money counts only live payments after go-live.</ReportHeader>
        <ReportSurface>
            <nav aria-label="Period" className="flex flex-wrap gap-1 border-b border-hairline p-4">
                <Link href={`/admin/metrics?period=${fyKey(thisFy)}`} prefetch={false} className={linkClass(report.period.kind === 'fy' && report.period.fy === thisFy)}>FY {thisFy} so far</Link>
                <Link href={`/admin/metrics?period=${fyKey(lastFy)}`} prefetch={false} className={linkClass(report.period.kind === 'fy' && report.period.fy === lastFy)}>FY {lastFy}</Link>
                {financialYearMonths(selectedFy).map(month => <Link key={month} href={`/admin/metrics?period=${month}`} prefetch={false} className={linkClass(report.period.kind === 'month' && report.period.month === month)}>{monthName(month)}</Link>)}
            </nav>

            <dl className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
                {!live && <MetricTile label="Wanted to pay" value={report.wantedToPay.length} href={list('wanted_to_pay')} sub="Tapped Notify me when paid plans open"/>}
                {live && <MetricTile label={`Revenue · ${periodLabel}`} value={report.revenue ? formatRupees(report.revenue.months.reduce((sum, month) => sum + month.newPaise + month.renewalPaise - month.refundPaise, 0)) : <NotYet/>} sub="Live payments minus refunds"/>}
                <MetricTile label="Accounts" value={totalAccounts} sub={(Object.keys(PLAN_LABELS) as (keyof typeof PLAN_LABELS)[]).filter(plan => plans[plan].length > 0 || plan === 'free' || plan === 'lite_trial' || plan === 'lite_paid').map(plan => `${PLAN_LABELS[plan]} ${plans[plan].length}`).join(' · ')}/>
                {!live && <MetricTile label="Revenue" value={<NotYet/>}/>}
                <MetricTile label="Trial conversion" value={report.trials ? <RateText rate={report.trials.rate}/> : <NotYet/>} href={report.trials ? list('trial_converted') : undefined}/>
                {live && <MetricTile label="Free → Lite" value={report.freeToLite ? <RateText rate={report.freeToLite.rate}/> : <NotYet/>} href={list('free_to_lite')}/>}
            </dl>

            <Section title="Money" note={live ? 'Live payments by capture month, refunds in their refund month. India time.' : undefined}>
                {!report.revenue ? <p className="text-sm text-body"><NotYet/>. Revenue counts live payments after you go live.</p> : <>
                    <BarList rows={report.revenue.months.map(month => {
                        const net = month.newPaise + month.renewalPaise - month.refundPaise
                        return { label: monthName(month.month), value: net, display: formatRupees(net), segments: [{ value: month.newPaise, className: 'bg-ink' }, { value: month.renewalPaise, className: 'bg-ink/45' }] }
                    })}/>
                    <p className="text-xs text-subtle">Dark: new purchases · Light: renewals</p>
                    <dl className="grid gap-4 text-sm sm:grid-cols-4">
                        <MetricTile label={`Lite · FY ${selectedFy}`} value={formatRupees(report.revenue.months.reduce((sum, month) => sum + month.litePaise, 0))}/>
                        <MetricTile label={`Base · FY ${selectedFy}`} value={formatRupees(report.revenue.months.reduce((sum, month) => sum + month.basePaise, 0))}/>
                        <MetricTile label="Last financial year" value={formatRupees(report.revenue.lastFyPaise)}/>
                        <MetricTile label="All time" value={formatRupees(report.revenue.allTimePaise)}/>
                    </dl>
                </>}
            </Section>

            <Section title="Accounts" note="Signups by month. Test, demo and internal accounts are left out.">
                <BarList rows={report.signups.map(entry => ({ label: monthName(entry.month), value: entry.ids.length, display: String(entry.ids.length) }))}/>
                <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    {(Object.keys(PLAN_LABELS) as (keyof typeof PLAN_LABELS)[]).map(plan => <li key={plan}><Link href={list(`plan_${plan}` as MetricList)} prefetch={false} className="inline-flex min-h-11 items-center underline underline-offset-4">{PLAN_LABELS[plan]} {plans[plan].length}</Link></li>)}
                </ul>
            </Section>

            <Section title="Getting started" note={`Signups at least 7 days old in ${periodLabel}. Coming back uses activity ${since.toLowerCase()}.`}>
                <dl className="grid gap-6 sm:grid-cols-3">
                    <MetricTile label="Signed up" value={report.activation.signedUp.length} href={list('signups')}/>
                    <MetricTile label="Saved a first costing within 7 days" value={<RateText rate={report.activation.activatedRate}/>} href={list('activated')} sub={<Link href={list('not_activated')} prefetch={false} className="underline underline-offset-4">See who didn&rsquo;t</Link>}/>
                    <MetricTile label="Came back on another day" value={<RateText rate={report.activation.cameBackRate}/>} href={list('came_back')}/>
                </dl>
            </Section>

            <Section title="Usage" note={since}>
                <BarList emptyText="No active time recorded in this period yet." rows={report.timeSpent.filter(month => month.accounts > 0).map(month => ({
                    label: monthName(month.month), value: month.averageMinutes ?? 0,
                    display: `avg ${month.averageMinutes} min · median ${month.medianMinutes} min · ${month.accounts} ${month.accounts === 1 ? 'account' : 'accounts'}`,
                }))}/>
                {report.timeSpent.filter(month => month.accounts > 0).slice(-1).map(month => <p key={month.month} className="text-sm text-body">By plan in {monthName(month.month)}: {Object.entries(month.byPlan).map(([plan, value]) => `${PLAN_LABELS[plan as keyof typeof PLAN_LABELS]} avg ${value.averageMinutes} min (${value.accounts})`).join(' · ') || 'none'}</p>)}
                <div className="grid gap-6 lg:grid-cols-2">
                    <div><h3 className="mb-2 text-sm font-semibold">Where the time goes</h3><BarList rows={ACTIVITY_AREAS.map(area => ({ label: AREA_LABELS[area], value: report.usage.areas[area], display: `${Math.round(report.usage.areas[area] * 100)}%` })).filter(row => row.value > 0)} emptyText="No active time recorded yet."/></div>
                    <div><h3 className="mb-2 text-sm font-semibold">Devices</h3><BarList rows={(['phone', 'tablet', 'desktop'] as const).map(device => ({ label: device[0].toUpperCase() + device.slice(1), value: report.usage.devices[device], display: `${Math.round(report.usage.devices[device] * 100)}%` })).filter(row => row.value > 0)} emptyText="No active time recorded yet."/><p className="mt-2 text-xs text-subtle">Installed app: {Math.round(report.usage.installedShare * 100)}% of minutes</p></div>
                </div>
            </Section>

            <Section title="Keeping customers" note={report.ghosts.estimated ? 'Ghost counts are estimated until activity tracking is 60 days old.' : undefined}>
                <dl className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricTile label="Trial outcomes" value={report.trials ? <RateText rate={report.trials.rate}/> : <NotYet/>}
                        sub={report.trials ? <span className="flex flex-wrap gap-x-3"><Link href={list('trial_converted')} prefetch={false} className="underline underline-offset-4">Converted {report.trials.converted.length}</Link><Link href={list('trial_back_to_free')} prefetch={false} className="underline underline-offset-4">Back to Free {report.trials.backToFree.length}</Link><Link href={list('trial_deciding')} prefetch={false} className="underline underline-offset-4">Deciding {report.trials.deciding.length}</Link></span> : undefined}/>
                    <MetricTile label="Free → Lite" value={report.freeToLite ? <RateText rate={report.freeToLite.rate}/> : <NotYet/>} href={report.freeToLite ? list('free_to_lite') : undefined}
                        sub={report.freeToLite?.medianDays != null ? `Typically ${report.freeToLite.medianDays} days on Free first` : undefined}/>
                    <MetricTile label="Lite renewal rate" value={report.renewals ? <RateText rate={report.renewals.rate}/> : <NotYet/>} href={report.renewals ? list('renewed') : undefined}
                        sub={report.renewals ? <Link href={list('won_back')} prefetch={false} className="underline underline-offset-4">Won back later {report.renewals.wonBack.length}</Link> : undefined}/>
                    <MetricTile label={`Ghost accounts${report.ghosts.estimated ? ' (estimated)' : ''}`} value={report.ghosts.neverStarted.length + report.ghosts.wentQuiet.length}
                        sub={<span className="flex flex-wrap gap-x-3"><Link href={list('ghost_never_started')} prefetch={false} className="underline underline-offset-4">Never started {report.ghosts.neverStarted.length}</Link><Link href={list('ghost_went_quiet')} prefetch={false} className="underline underline-offset-4">Went quiet {report.ghosts.wentQuiet.length}</Link></span>}/>
                </dl>
            </Section>
        </ReportSurface>
    </>
}

