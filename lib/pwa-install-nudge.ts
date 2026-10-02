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

export function isPwaInstallWorkspace(pathname: string) {
    return pathname === '/free' || pathname.startsWith('/free/') || pathname.startsWith('/owner/')
}

export type PwaInstallPrompt = Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** An accepted browser prompt is not installation evidence; appinstalled is. */
export async function requestPwaInstallation(prompt: PwaInstallPrompt): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    try {
        await prompt.prompt()
        return (await prompt.userChoice).outcome
    } catch { return 'unavailable' }
}

export type PwaInstallCoordinator = ReturnType<typeof createPwaInstallCoordinator>

/** A short quiet period follows success; elapsed time alone never qualifies. */
export function createPwaInstallCoordinator(options: {
    canShow: () => boolean
    readPreference: () => PwaNudgePreference
    writePreference: (preference: PwaNudgePreference) => void
    onVisibility: (visible: boolean) => void
    now?: () => number
}) {
    const now = options.now ?? Date.now
    let pendingSuccess = false
    let visible = false
    let impressionRecorded = false
    let disposed = false
    let suppressed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const clearTimer = () => { clearTimeout(timer); timer = undefined }
    const hide = () => {
        if (visible) { visible = false; options.onVisibility(false) }
        impressionRecorded = false
    }
    const eligible = () => {
        try { return !suppressed && options.canShow() && isPwaNudgeDue(options.readPreference(), now()) } catch { return false }
    }
    const recheck = () => {
        if (disposed) return
        clearTimer()
        if (visible) {
            if (!options.canShow()) hide()
            return
        }
        if (!pendingSuccess || !eligible()) return
        timer = setTimeout(() => {
            timer = undefined
            if (disposed || !pendingSuccess || !eligible()) return
            visible = true
            options.onVisibility(true)
        }, 1500)
    }
    const interrupt = () => {
        pendingSuccess = false
        clearTimer()
        hide()
    }
    return {
        workflowSucceeded() { if (!disposed) { pendingSuccess = true; recheck() } },
        recheck,
        interrupt,
        confirmVisible() {
            if (disposed || !visible || !options.canShow()) return false
            if (impressionRecorded) return true
            try {
                const preference = options.readPreference()
                if (!isPwaNudgeDue(preference, now())) { interrupt(); return false }
                options.writePreference({ ...preference, lastShownAt: now() })
                impressionRecorded = true
                pendingSuccess = false
                return true
            } catch { interrupt(); return false }
        },
        dismissForever() {
            suppressed = true
            try { options.writePreference({ ...options.readPreference(), dismissed: true }) } catch { /* Keep this session dismissed. */ }
            interrupt()
        },
        dispose() { disposed = true; clearTimer() },
    }
}
