import { NextResponse } from 'next/server'
import { readOwnSupportExport } from '@/lib/support/data-rights'
import { requireSupportOwner, supportError } from '@/lib/support/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        // API denial stays JSON and the rollout gate applies independently.
        await requireSupportOwner()
        const result = await readOwnSupportExport()
        return NextResponse.json({ schemaVersion: 'requester-support-v1', ...result }, {
            headers: {
                'Cache-Control': 'private, no-store', Vary: 'Cookie',
                'Content-Disposition': 'attachment; filename="weavly-my-public-support.json"',
                'X-Content-Type-Options': 'nosniff',
            },
        })
    } catch (error) { return supportError(error) }
}
