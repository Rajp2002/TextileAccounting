import { NextResponse } from 'next/server'
import { requireSupportOwner } from '@/lib/support/server'
import { adminErrorResponse } from '@/lib/admin/errors'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const principal = await requireSupportOwner()
        return NextResponse.json({ userId: principal.userId }, {
            headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
        })
    } catch (error) { return adminErrorResponse(error) }
}
