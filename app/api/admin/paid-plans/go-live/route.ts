import { goLive } from '@/lib/admin/paid-plans'
import { reportResponse } from '@/lib/admin/report-http'
export const dynamic = 'force-dynamic'
export async function POST() {
    return reportResponse(() => goLive())
}
