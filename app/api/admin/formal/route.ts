import { listFormalCases, mutateFormalCase } from '@/lib/admin/formal'
import { reportResponse, queryObject } from '@/lib/admin/report-http'
import { supportBody } from '@/lib/support/server'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) { return reportResponse(() => listFormalCases(queryObject(request))) }
export async function POST(request: Request) { return reportResponse(async () => mutateFormalCase('create', null, null, await supportBody(request))) }
