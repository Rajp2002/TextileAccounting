import { NextResponse } from 'next/server'
import { getFactoryDetail } from '@/lib/admin/factories'
import { adminErrorResponse } from '@/lib/admin/errors'
export const dynamic = 'force-dynamic'
export async function GET(_request: Request, context: { params: Promise<{ orgId: string }> }) {
    try {
        const result = await getFactoryDetail((await context.params).orgId)
        return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' } })
    } catch (error) { return adminErrorResponse(error) }
}
