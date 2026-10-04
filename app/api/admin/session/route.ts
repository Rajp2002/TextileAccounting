import { NextResponse } from 'next/server'
import { requireFounder, touchFounderSession } from '@/lib/admin/founder'
import { AdminError, adminErrorResponse } from '@/lib/admin/errors'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET() {
    try {
        const principal = await requireFounder()
        return NextResponse.json({ userId: principal.userId }, { headers })
    } catch (error) { return adminErrorResponse(error) }
}

export async function POST(request: Request) {
    try {
        if (request.headers.get('origin') !== new URL(request.url).origin) {
            throw new AdminError('FORBIDDEN', 403, 'Invalid request origin.')
        }
        await touchFounderSession()
        return new NextResponse(null, { status: 204, headers })
    } catch (error) { return adminErrorResponse(error) }
}
