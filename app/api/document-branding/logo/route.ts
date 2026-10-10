import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { checkAuthRateLimit } from '@/lib/rate-limit'
import { requireBrandingManager } from '@/lib/document-branding/access.server'
import { LOGO_MAX_UPLOAD_BYTES } from '@/lib/document-branding/limits'
import { createLogoCandidate, logBrandingEvent } from '@/lib/document-branding/service.server'

export const runtime = 'nodejs'
// Tracing a bounded logo takes well under a second; this leaves room for
// storage round trips on a slow connection.
export const maxDuration = 60

/**
 * Upload a candidate factory logo. A route handler rather than a server
 * action because server action bodies are capped at 1 MB. The response is
 * a code only; the Settings screen reloads the review state itself.
 */
export async function POST(request: Request) {
    const access = await requireBrandingManager()
    if (!access.ok) {
        logBrandingEvent('entitlement_rejected', { code: access.code })
        return NextResponse.json({ ok: false, code: access.code }, { status: 403 })
    }

    const declaredLength = Number(request.headers.get('content-length') ?? 0)
    // Multipart framing adds a little over the file itself.
    if (declaredLength > LOGO_MAX_UPLOAD_BYTES + 64 * 1024) {
        return NextResponse.json({ ok: false, code: 'file_too_large' }, { status: 413 })
    }

    if (await checkAuthRateLimit(`logo-upload:${access.orgId}`) !== null) {
        return NextResponse.json({ ok: false, code: 'rate_limited' }, { status: 429 })
    }

    try {
        const form = await request.formData()
        const file = form.get('file')
        if (!(file instanceof File)) return NextResponse.json({ ok: false, code: 'file_missing' }, { status: 400 })
        if (file.size > LOGO_MAX_UPLOAD_BYTES) return NextResponse.json({ ok: false, code: 'file_too_large' }, { status: 413 })

        const result = await createLogoCandidate({
            orgId: access.orgId,
            userId: access.userId,
            bytes: Buffer.from(await file.arrayBuffer()),
            claimedType: file.type || null,
        })
        return NextResponse.json(result, { status: result.ok ? 200 : result.code === 'storage_failed' ? 503 : 422 })
    } catch (error) {
        Sentry.captureException(error, { tags: { route: 'document_branding_logo', method: 'POST' } })
        return NextResponse.json({ ok: false, code: 'upload_failed' }, { status: 500 })
    }
}
