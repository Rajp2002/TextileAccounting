import { NextResponse, type NextRequest } from 'next/server'
import { getCachedSession } from '@/lib/auth'
import { getOrgPlanAccess } from '@/lib/subscription'
import {
    freeWorkspaceHintValue,
    isFreeWorkspaceAccess,
    WORKSPACE_HINT_COOKIE,
    WORKSPACE_HINT_COOKIE_OPTIONS,
} from '@/lib/workspace-hint'

export const dynamic = 'force-dynamic'

/**
 * Rewrites the Proxy routing hint from the verified profile and the current
 * plan. Layouts call this only when the hint they received is out of date.
 * The client chooses nothing: the value is derived entirely on the server.
 */
export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin')
    if (origin && origin !== request.nextUrl.origin) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    }

    const session = await getCachedSession()
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const freeWorkspace = session.profile.role === 'owner'
        && isFreeWorkspaceAccess(await getOrgPlanAccess(session.profile.org_id))
    const response = new NextResponse(null, {
        status: 204,
        headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    })
    if (freeWorkspace) {
        response.cookies.set(WORKSPACE_HINT_COOKIE, freeWorkspaceHintValue(session.user.id), WORKSPACE_HINT_COOKIE_OPTIONS)
    } else {
        response.cookies.delete(WORKSPACE_HINT_COOKIE)
    }
    return response
}
