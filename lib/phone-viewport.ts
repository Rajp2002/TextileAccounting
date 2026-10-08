'use client'

import { useSyncExternalStore } from 'react'

/**
 * The phone layout, exactly as `app/mobile.css` defines it (portrait phones, and landscape phones
 * up to the tablet breakpoint). Guided tours and explainer pills are not rendered here: the phone
 * has no rail to hold them and every pixel above the task counts.
 *
 * `app/mobile.css` repeats this query for the `.phone-guidance` rule so the pills are hidden on
 * first paint, before hydration; `__tests__/phone-guidance-suppression.test.ts` keeps both copies equal.
 */
export const PHONE_VIEWPORT_QUERY = '(max-width: 767.98px), (pointer: coarse) and (max-height: 500px) and (max-width: 1023.98px)'

function subscribe(onChange: () => void) {
    const media = window.matchMedia(PHONE_VIEWPORT_QUERY)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
}

const getSnapshot = () => window.matchMedia(PHONE_VIEWPORT_QUERY).matches

/** False on the server, so the first render matches the desktop markup and `.phone-guidance` hides it. */
const getServerSnapshot = () => false

export function usePhoneViewport() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
