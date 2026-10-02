export const STARTUP_INTRO_PREFERENCE_KEY = 'weavly:startup-intro:preference'
export const STARTUP_INTRO_SEEN_KEY = 'weavly:startup-intro:seen'
export const STARTUP_INTRO_PROBE_KEY = 'weavly:startup-intro:storage-check'
export const STARTUP_INTRO_CHANGE_EVENT = 'weavly:startup-intro-change'

export type StartupIntroPreference = 'first-launch' | 'always' | 'never'
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

/** A missing or unrecognised preference keeps the first-launch-only default. */
export function readStartupIntroPreference(storage: Pick<Storage, 'getItem'>): StartupIntroPreference | null {
    try {
        const value = storage.getItem(STARTUP_INTRO_PREFERENCE_KEY)
        return value === 'always' || value === 'never' ? value : 'first-launch'
    } catch {
        return null
    }
}

export function saveStartupIntroPreference(storage: PreferenceStorage, preference: StartupIntroPreference): boolean {
    try {
        storage.setItem(STARTUP_INTRO_PREFERENCE_KEY, preference)
        return true
    } catch {
        return false
    }
}
