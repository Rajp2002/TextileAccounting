import { goLive } from '@/lib/admin/paid-plans'
import { reportResponse } from '@/lib/admin/report-http'
import { supportBody } from '@/lib/support/server'
export const dynamic = 'force-dynamic'
// Same-origin JSON only, like every other founder action: going live cannot be undone here.
export async function POST(request: Request) {
    return reportResponse(async () => { await supportBody(request); return goLive() })
}
