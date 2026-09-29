'use client'

import { useEffect } from 'react'
import type { IntroWindow } from '@/lib/intro/intro-policy'
import type { IntroSurface } from '@/lib/intro/weave-timeline'

/**
 * The woven brand intro. The black stage and Skip control are server-rendered
 * but hidden by CSS unless the pre-paint script (IntroPrePaintScript) chose to
 * play, so the first paint is already correct either way. The WebGL runtime is
 * loaded only when the intro actually plays.
 *
 * The runtime starts as soon as this module is evaluated, not in an effect:
 * effects wait for the whole page to hydrate, which on a cold mobile launch is
 * the slowest step. The server-rendered stage and Skip nodes already exist and
 * hydration keeps them, so the runtime drives them directly.
 */
const started = new Set<IntroSurface>()

function boot(surface: IntroSurface) {
    if (typeof window === 'undefined' || started.has(surface)) return
    const handle = (window as IntroWindow).__weavlyIntro
    if (!handle || handle.surface !== surface || handle.state !== 'pending') return
    started.add(surface)

    const find = () => {
        const overlay = document.querySelector<HTMLElement>(`.weavly-intro[data-surface="${surface}"]`)
        const skipButton = document.querySelector<HTMLButtonElement>(`.weavly-intro-skip[data-surface="${surface}"]`)
        return overlay && skipButton ? { overlay, skipButton } : null
    }
    const run = () => {
        const nodes = find()
        if (!nodes || handle.state !== 'pending') return
        import('./weaving-intro-runtime')
            .then(({ startWeavingIntro }) => {
                if (handle.state !== 'pending') return
                const stop = startWeavingIntro({ surface, ...nodes, handle })
                stops.set(surface, stop)
            })
            .catch(() => handle.abort())
    }
    // Streamed HTML may not have delivered the stage yet.
    if (find()) run()
    else document.addEventListener('DOMContentLoaded', run, { once: true })
}

const stops = new Map<IntroSurface, () => void>()

boot('landing')
boot('app-login')

export function WeavingIntro({ surface }: { surface: IntroSurface }) {
    useEffect(() => {
        // Covers the pre-hydration case where the handle did not exist at module load.
        boot(surface)
        return () => {
            // A real unmount (not a Strict Mode effect re-run) must not leave the stage behind.
            window.setTimeout(() => {
                const overlay = document.querySelector(`.weavly-intro[data-surface="${surface}"]`)
                if (overlay?.isConnected) return
                const handle = (window as IntroWindow).__weavlyIntro
                stops.get(surface)?.()
                stops.delete(surface)
                started.delete(surface)
                if (handle && handle.state === 'pending') handle.abort()
            }, 0)
        }
    }, [surface])

    return (
        <>
            <div className="weavly-intro" data-surface={surface} aria-hidden="true" />
            <button type="button" className="weavly-intro-skip" data-surface={surface}>
                Skip intro
            </button>
        </>
    )
}
