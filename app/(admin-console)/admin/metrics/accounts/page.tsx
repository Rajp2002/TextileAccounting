import Link from 'next/link'
import { getMetricAccounts, type MetricList } from '@/lib/admin/growth'
import { AdminError } from '@/lib/admin/errors'
import { ReportHeader, ReportSurface, SourceUnavailable } from '@/components/admin/report-ui'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata = { title: 'Metric accounts' }

const TITLES: Record<MetricList, string> = {
    plan_free: 'Free accounts', plan_lite_trial: 'Lite trial accounts', plan_lite_paid: 'Lite paid accounts', plan_base: 'Base accounts', plan_none: 'Accounts with no access',
    signups: 'Signups', activated: 'Saved a first costing within 7 days', not_activated: 'No costing within 7 days', came_back: 'Came back on another day',
    trial_converted: 'Trials that converted', trial_back_to_free: 'Trials back to Free', trial_deciding: 'Trials still deciding', free_to_lite: 'Free accounts that bought Lite',
    renewed: 'Renewed Lite', won_back: 'Won back after lapsing', ghost_never_started: 'Ghost accounts: never started', ghost_went_quiet: 'Ghost accounts: went quiet',
    trials_ending: 'Trials ending in the next 14 days', renewals_due: 'Renewals due in the next 30 days', upgrade_signals: 'Upgrade signals in the last 14 days', wanted_to_pay: 'Wanted to pay',
}
const PLAN_LABELS: Record<string, string> = { free: 'Free', lite_trial: 'Lite trial', lite_paid: 'Lite paid', base: 'Base', none: 'No access' }
const date = (value: string | null) => value ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(value)) : 'Never'

export default async function MetricAccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams
    const query = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]))
    let result: Awaited<ReturnType<typeof getMetricAccounts>>
    try { result = await getMetricAccounts(query) }
    catch (error) {
        const invalid = error instanceof AdminError && error.status === 400
        return <><ReportHeader title="Accounts">The factories behind a number on Metrics.</ReportHeader>
            <SourceUnavailable title={invalid ? 'Choose a number on Metrics' : "Metrics couldn't be loaded"}>{invalid ? 'This list does not exist.' : 'Nothing has changed. Try again in a minute.'}</SourceUnavailable>
            <Link href="/admin/metrics" prefetch={false} className="mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4">Back to Metrics</Link></>
    }
    const back = `/admin/metrics?period=${result.periodKey}`
    return <>
        <ReportHeader title={TITLES[result.list]}>{result.rows.length} {result.rows.length === 1 ? 'factory' : 'factories'}. <Link href={back} prefetch={false} className="underline underline-offset-4">Back to Metrics</Link></ReportHeader>
        <ReportSurface>
            {result.rows.length === 0 ? <p className="p-6 text-sm text-body">No factories in this list right now.</p> : <>
                <ul className="divide-y divide-hairline sm:hidden">
                    {result.rows.map(row => <li key={row.orgId} className="p-4">
                        <Link href={`/admin/factories/${row.orgId}`} prefetch={false} className="inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline">{row.name}</Link>
                        <p className="text-sm text-body">{PLAN_LABELS[row.plan] ?? row.plan} · joined {date(row.joinedAt)}</p>
                        <p className="text-sm text-body">Last seen {date(row.lastSeen)} · {row.minutesLast30} min in the last 30 days</p>
                    </li>)}
                </ul>
                <table className="hidden w-full text-left text-sm sm:table">
                    <thead className="border-b border-hairline text-xs text-subtle"><tr><th className="p-4 font-medium">Factory</th><th className="p-4 font-medium">Plan</th><th className="p-4 font-medium">Joined</th><th className="p-4 font-medium">Last seen</th><th className="p-4 text-right font-medium">Minutes, last 30 days</th></tr></thead>
                    <tbody className="divide-y divide-hairline">
                        {result.rows.map(row => <tr key={row.orgId}>
                            <td className="p-4"><Link href={`/admin/factories/${row.orgId}`} prefetch={false} className="font-medium underline-offset-4 hover:underline">{row.name}</Link></td>
                            <td className="p-4">{PLAN_LABELS[row.plan] ?? row.plan}</td>
                            <td className="p-4">{date(row.joinedAt)}</td>
                            <td className="p-4">{date(row.lastSeen)}</td>
                            <td className="p-4 text-right tabular-nums">{row.minutesLast30}</td>
                        </tr>)}
                    </tbody>
                </table>
            </>}
        </ReportSurface>
    </>
}
