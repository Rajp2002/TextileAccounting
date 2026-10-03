'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '@/lib/i18n/context'
import { AUTH_TRANSITION_LEAVE_MS } from './auth-transition-timing'
import { LoomMark, SpoolMark } from './thread-marks'

export type AuthTransitionMode = 'sign-in' | 'sign-up' | 'sign-out'
/** `done`: the server accepted the request and the next page is loading. */
export type AuthTransitionStage = 'working' | 'done'

const COPY = {
    'sign-in': {
        working: ['auth.transition.sign_in_title', 'auth.transition.sign_in_detail'],
        done: ['auth.transition.signed_in_title', 'auth.transition.signed_in_detail'],
    },
    'sign-up': {
        working: ['auth.transition.sign_up_title', 'auth.transition.sign_up_detail'],
        done: ['auth.transition.sign_up_title', 'auth.transition.sign_up_detail'],
    },
    'sign-out': {
        working: ['auth.transition.sign_out_title', 'auth.transition.sign_out_detail'],
        done: ['auth.transition.sign_out_title', 'auth.transition.sign_out_detail'],
    },
} as const satisfies Record<AuthTransitionMode, Record<AuthTransitionStage, readonly [string, string]>>

interface AuthTransitionProps {
    open: boolean
    mode: AuthTransitionMode
    stage?: AuthTransitionStage
}

/**
 * Full-screen handoff shown while an account crosses the sign-in boundary.
 *
 * It opens on submit and stays up through the full-page navigation. Sign-in
 * and log out navigate as soon as the request succeeds and hand the overlay to
 * the next page (`captureAuthHandoff`, `AuthHandoffScript`), which carries the
 * round on and removes it when the round ends, so the next page loads behind
 * the animation and appears the moment the round is done. If the request fails
 * it fades out so the form and its error are back in reach.
 */
export function AuthTransition({ open, mode, stage = 'working' }: AuthTransitionProps) {
    const { t } = useTranslation()
    const [wasOpen, setWasOpen] = useState(open)
    const [leaving, setLeaving] = useState(false)

    // Keep the overlay mounted for its exit animation after `open` turns off.
    if (open !== wasOpen) {
        setWasOpen(open)
        setLeaving(!open)
    }

    useEffect(() => {
        if (!leaving) return
        const timer = window.setTimeout(() => setLeaving(false), AUTH_TRANSITION_LEAVE_MS)
        return () => window.clearTimeout(timer)
    }, [leaving])

    if ((!open && !leaving) || typeof document === 'undefined') return null

    const [titleKey, detailKey] = COPY[mode][stage]
    const Mark = mode === 'sign-out' ? SpoolMark : LoomMark

    return createPortal(
        <div
            className="auth-transition"
            data-state={open ? 'open' : 'closed'}
            data-stage={stage}
            data-mode={mode}
        >
            <div className="auth-transition-mark">
                <Mark className="h-full w-full" />
            </div>
            <div role="status" aria-live="polite" aria-atomic="true" className="auth-transition-copy">
                {/* Keyed so the new line swaps in when the stage changes. */}
                <div key={stage} className="ui-content-swap">
                    <p className="text-base font-semibold text-ink">{t(titleKey)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{t(detailKey)}</p>
                </div>
            </div>
        </div>,
        document.body,
    )
}
