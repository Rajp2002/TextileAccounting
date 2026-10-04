import { getPaymentsReport } from '@/lib/admin/payments'
import { queryObject, reportResponse } from '@/lib/admin/report-http'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export async function GET(request: Request) { return reportResponse(() => getPaymentsReport(queryObject(request))) }
