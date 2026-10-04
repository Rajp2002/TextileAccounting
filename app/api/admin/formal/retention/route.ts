import { getRetentionReview } from '@/lib/admin/retention'
import { reportResponse, queryObject } from '@/lib/admin/report-http'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) { return reportResponse(() => getRetentionReview(queryObject(request))) }
