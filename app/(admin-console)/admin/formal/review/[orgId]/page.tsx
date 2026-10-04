import Link from 'next/link'
import { requireFounderPage } from '@/lib/admin/founder'
import { getRetainedRecordReview, retainedGroupLabels, type RetainedReview } from '@/lib/admin/data-rights-review'
import { AdminFreshness, AdminPageHeader, AdminSurface, AdminUnavailable } from '@/components/admin/primitives'
import { SensitiveBoundary } from '@/components/admin/sensitive-boundary'
export const dynamic = 'force-dynamic'
export default async function Page({ params }: { params: Promise<{ orgId: string }> }) {
    const who = await requireFounderPage(), { orgId } = await params
    let report: RetainedReview | null = null
    try { report = await getRetainedRecordReview(orgId) } catch { /* No erasure permission can be inferred from a failed source. */ }
    if (!report) return <AdminUnavailable description="Retained records could not be verified. No erasure decision has been assumed."/>
    return <SensitiveBoundary userId={who.userId} kind="founder"><AdminPageHeader title="Account deletion review" description="Counts identify records that need a case-by-case decision. This view cannot erase data or approve a deletion." action={<Link href={`/admin/factories/${orgId}`} prefetch={false} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Back to factory</Link>}/><AdminSurface className="p-5"><h2 className="font-semibold">{report.reviewRequired ? 'Retained records need review' : 'No retained blocker found in this catalog'}</h2><p className="mt-2 text-sm leading-6 text-subtle">{report.foundationReviewRequired ? 'Support, reporting or protected identity records are linked to this account. ' : ''}The database rechecks readiness when the owner requests deletion. A preview is not an approval, and no provider cancellation is performed.</p><dl className="mt-5 divide-y divide-hairline">{report.groups.map(group => <div key={group.key} className="flex flex-wrap justify-between gap-3 py-4 text-sm"><dt>{retainedGroupLabels[group.key]}</dt><dd className="font-medium">{group.count}{group.more ? '+' : ''}</dd></div>)}</dl><p className="mt-4 text-xs text-subtle">Each group is bounded at {report.countLimit} records. Counts can overlap when an identity appears in more than one source.</p><Link href="/admin/formal/new?kind=privacy" prefetch={false} className="mt-5 inline-flex min-h-11 items-center text-sm underline underline-offset-4">Record the received privacy request</Link></AdminSurface><AdminFreshness asOf={report.asOf}/></SensitiveBoundary>
}
