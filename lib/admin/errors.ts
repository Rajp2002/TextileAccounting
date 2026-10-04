import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'

export class AdminError extends Error {
    readonly publicMessage: string
    readonly requestId: string
    constructor(
        readonly code: string,
        readonly status: number,
        message: string,
        readonly fieldErrors?: Record<string, string[]>,
        requestId?: string,
    ) {
        super(message)
        this.name = 'AdminError'
        this.publicMessage = message
        this.requestId = requestId ?? randomUUID()
    }
}

export { AdminError as ApiError }

/** Unknown database/provider failures never cross the HTTP boundary. */
export function adminErrorResponse(error: unknown, requestId = randomUUID()) {
    const safe = error instanceof AdminError
        ? error
        : new AdminError('UNAVAILABLE', 503, 'This source is unavailable. Please try again.', undefined, requestId)
    return NextResponse.json({
        code: safe.code,
        message: safe.publicMessage,
        requestId: safe.requestId,
        ...(safe.fieldErrors ? { fieldErrors: safe.fieldErrors } : {}),
    }, { status: safe.status, headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' } })
}
