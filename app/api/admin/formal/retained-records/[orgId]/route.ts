import { getRetainedRecordReview } from '@/lib/admin/data-rights-review'
import { reportResponse } from '@/lib/admin/report-http'
export const dynamic = 'force-dynamic'
export async function GET(_request: Request, context: { params: Promise<{ orgId: string }> }) { return reportResponse(async () => getRetainedRecordReview((await context.params).orgId)) }
