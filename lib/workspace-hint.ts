import type { OrgPlanAccess } from './subscription-access'

/**
 * Non-authoritative routing hint that lets Proxy send a Free owner straight
 * to /free on app launch instead of bouncing through /owner/estimator.
 *
 * It is written only where the plan was already resolved server-side (the
 * sign-in action, and /api/workspace-hint when a workspace layout finds the
 * hint out of date) and is bound to the user id, so another account on the
 * same browser never inherits it. Proxy treats it purely as a guess: the Free
 * and owner layouts resolve the plan again, and a stale hint for a paid org
 * is corrected by the Free layout and then cleared by the owner layout.
 */
export const WORKSPACE_HINT_COOKIE = 'weavly_workspace_hint'
export const FREE_WORKSPACE_PATH = '/free'

export const WORKSPACE_HINT_COOKIE_OPTIONS = {
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
} as const

export function freeWorkspaceHintValue(userId: string): string {
    return `free.${userId}`
}

export function hasFreeWorkspaceHint(value: string | undefined, userId: string | null | undefined): boolean {
    return Boolean(value && userId && value === freeWorkspaceHintValue(userId))
}

/** Mirrors the owner layout and requireRole rule that sends an org to /free. */
export function isFreeWorkspaceAccess(access: Pick<OrgPlanAccess, 'effectiveTier' | 'freeAccount'>): boolean {
    return access.effectiveTier === 'free' || access.freeAccount === true
}
