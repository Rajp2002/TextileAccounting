import { NextResponse } from 'next/server'
import { requireFounderCandidate } from '@/lib/admin/founder'
import { founderCandidateTag } from '@/lib/admin/founder-candidate-tag'
import { adminErrorResponse } from '@/lib/admin/errors'

export const dynamic = 'force-dynamic'

/** Candidate identity only. Never returns a factory, grant or Auth session ID. */
export async function GET() {
    try {
        const candidate = await requireFounderCandidate()
        return NextResponse.json({ userId: candidate.userId, sessionTag: founderCandidateTag(candidate) }, {
            headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
        })
    } catch (error) { return adminErrorResponse(error) }
}
