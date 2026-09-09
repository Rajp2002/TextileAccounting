export const PWA_NUDGE_STORAGE_KEY = 'weavly:pwa-install-nudge:v1'
export const PWA_NUDGE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

export type PwaNudgePreference = { dismissed: boolean; lastShownAt: number }

export function readPwaNudgePreference(raw: string | null): PwaNudgePreference {
    try {
        const value = JSON.parse(raw || '{}')
        return {
            dismissed: value?.dismissed === true,
            lastShownAt: typeof value?.lastShownAt === 'number' && Number.isFinite(value.lastShownAt) && value.lastShownAt > 0
                ? value.lastShownAt : 0,
        }
    } catch {
        return { dismissed: false, lastShownAt: 0 }
    }
}

export function isPwaNudgeDue(preference: PwaNudgePreference, now: number): boolean {
    return !preference.dismissed && (preference.lastShownAt === 0 || now - preference.lastShownAt >= PWA_NUDGE_INTERVAL_MS)
}
