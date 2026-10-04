import { getAdminSystem } from '@/lib/admin/system'
import { reportResponse } from '@/lib/admin/report-http'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export async function GET() { return reportResponse(getAdminSystem) }
