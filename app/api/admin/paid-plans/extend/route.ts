import { extendTrials } from '@/lib/admin/paid-plans'
import { reportResponse } from '@/lib/admin/report-http'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
    return reportResponse(async () => extendTrials(await request.json().catch(() => null)))
}
