import { getLegacyRecord } from '@/lib/admin/legacy-read'
import { reportResponse } from '@/lib/admin/report-http'
export const dynamic = 'force-dynamic'
export async function GET(_request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
    const { kind, id } = await context.params
    return reportResponse(() => getLegacyRecord(kind, id))
}
