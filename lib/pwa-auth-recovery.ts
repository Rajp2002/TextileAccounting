export const PWA_LOGIN_RECOVERY_HEADER = 'x-weavly-pwa-recovery-destination'
export const PWA_LOGIN_RECOVERY_COOKIE = 'weavly_pwa_login_redirect_at'
export const PWA_LOGIN_RECOVERY_WINDOW_MS = 30_000

export function isRecentPwaLoginRedirect(value: string | undefined, now: number): boolean {
    if (!value) return false

    const redirectStartedAt = Number(value)
    if (!Number.isFinite(redirectStartedAt) || redirectStartedAt > now) return false

    return now - redirectStartedAt <= PWA_LOGIN_RECOVERY_WINDOW_MS
}
