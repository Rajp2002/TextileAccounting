import { setFactoryCohort } from '@/lib/admin/cohort'
import { reportResponse } from '@/lib/admin/report-http'
import { supportBody } from '@/lib/support/server'
export const dynamic = 'force-dynamic'
export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
    const orgId = (await context.params).orgId
    return reportResponse(async () => setFactoryCohort(orgId, await supportBody(request)))
}
