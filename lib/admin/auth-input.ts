import { z } from 'zod'

export const founderPasswordInput = z.object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(1024),
})

export const founderChallengeInput = z.object({
    factorId: z.string().uuid(),
    code: z.string().regex(/^\d{6}$/),
    enrollmentIntentId: z.string().uuid().optional(),
})

/** Server Actions also have Next.js' Origin/Host protection. Fail closed here. */
export function founderMutationOriginAllowed(headers: Pick<Headers, 'get'>): boolean {
    const origin = headers.get('origin')
    const host = headers.get('x-forwarded-host') ?? headers.get('host')
    if (!origin || !host || host.includes(',')) return false
    try {
        const parsed = new URL(origin)
        return ['https:', 'http:'].includes(parsed.protocol) && parsed.host === host
            && parsed.username === '' && parsed.password === '' && parsed.pathname === '/' && parsed.search === '' && parsed.hash === ''
    } catch { return false }
}

export type FounderAuthState = { code?: string; message?: string; requestId?: string }
