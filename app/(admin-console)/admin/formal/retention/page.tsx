import { requireFounderPage } from '@/lib/admin/founder'
import { getRetentionReview } from '@/lib/admin/retention'
import { SensitiveBoundary } from '@/components/admin/sensitive-boundary'
import { RetentionReviewScreen } from '@/components/admin/retention-review'
import { AdminUnavailable } from '@/components/admin/primitives'
export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const who = await requireFounderPage()
    let report: Awaited<ReturnType<typeof getRetentionReview>> | null = null
    try { report = await getRetentionReview(await searchParams) } catch { /* Explicit unavailable state below. */ }
    if (!report) return <AdminUnavailable description="Retention evidence could not be verified. No period, hold count or permission to erase has been assumed."/>
    return <SensitiveBoundary userId={who.userId} kind="founder"><RetentionReviewScreen report={report}/></SensitiveBoundary>
}
