import { listLegacyDpaBindings } from '@/lib/admin/legacy-read'
import { queryObject, reportResponse } from '@/lib/admin/report-http'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    return reportResponse(() => listLegacyDpaBindings(id, queryObject(request)))
}
