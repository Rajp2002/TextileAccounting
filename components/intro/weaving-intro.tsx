'use client'

import { useEffect, useRef } from 'react'
import type { IntroWindow } from '@/lib/intro/intro-policy'
import type { IntroSurface } from '@/lib/intro/weave-timeline'

/**
 * The woven brand intro. The black stage and Skip control are server-rendered
 * but hidden by CSS unless the pre-paint script (IntroPrePaintScript) chose to
 * play, so the first paint is already correct either way. The WebGL runtime is
 * loaded only when the intro actually plays.
 */
export function WeavingIntro({ surface }: { surface: IntroSurface }) {
    const overlayRef = useRef<HTMLDivElement>(null)
    const skipRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        const handle = (window as IntroWindow).__weavlyIntro
        const overlay = overlayRef.current
        const skipButton = skipRef.current
        if (!handle || handle.surface !== surface || handle.state !== 'pending' || !overlay || !skipButton) return

        let cancelled = false
        let stop: (() => void) | null = null
        import('./weaving-intro-runtime')
            .then(({ startWeavingIntro }) => {
                if (cancelled || handle.state !== 'pending') return
                stop = startWeavingIntro({ surface, overlay, skipButton, handle })
            })
            .catch(() => handle.abort())

        return () => {
            cancelled = true
            stop?.()
            // A real unmount (not a Strict Mode effect re-run) must not leave the stage behind.
            window.setTimeout(() => {
                if (!overlay.isConnected && handle.state === 'pending') handle.abort()
            }, 0)
        }
    }, [surface])

    return (
        <>
            <div ref={overlayRef} className="weavly-intro" data-surface={surface} aria-hidden="true" />
            <button ref={skipRef} type="button" className="weavly-intro-skip" data-surface={surface}>
                Skip intro
            </button>
        </>
    )
}
