import { getFormalCase, mutateFormalCase } from '@/lib/admin/formal'
import { reportResponse, queryObject } from '@/lib/admin/report-http'
import { AdminError } from '@/lib/admin/errors'
import { supportBody } from '@/lib/support/server'
export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ kind: string; id: string }> }
export async function GET(request: Request, context: Context) { return reportResponse(async () => { const { kind, id } = await context.params; return getFormalCase(kind, id, queryObject(request)) }) }
export async function POST(request: Request, context: Context) {
    return reportResponse(async () => {
        const { kind, id } = await context.params, body = await supportBody(request)
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AdminError('INVALID_INPUT', 400, 'Check the operation.')
        const { operation, ...input } = body as Record<string, unknown>
        if (operation !== 'adopt' && operation !== 'update' && operation !== 'note') throw new AdminError('INVALID_INPUT', 400, 'Check the operation.')
        return mutateFormalCase(operation, kind, id, input)
    })
}
