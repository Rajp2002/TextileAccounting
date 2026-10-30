import { extendTrials } from '@/lib/admin/paid-plans'
import { reportResponse } from '@/lib/admin/report-http'
import { supportBody } from '@/lib/support/server'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
    return reportResponse(async () => extendTrials(await supportBody(request)))
}
