import { listLegacyRecords } from '@/lib/admin/legacy-read'
import { queryObject, reportResponse } from '@/lib/admin/report-http'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) { return reportResponse(() => listLegacyRecords(queryObject(request))) }
