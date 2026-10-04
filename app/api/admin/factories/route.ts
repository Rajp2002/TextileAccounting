import { NextRequest, NextResponse } from 'next/server'
import { listFactories } from '@/lib/admin/factories'
import { adminErrorResponse } from '@/lib/admin/errors'
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
    try {
        const result = await listFactories(Object.fromEntries(request.nextUrl.searchParams))
        return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' } })
    } catch (error) { return adminErrorResponse(error) }
}
