'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Download, X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { isPwaNudgeDue, PWA_NUDGE_STORAGE_KEY, readPwaNudgePreference } from '@/lib/pwa-install-nudge'

const copy = {
    en: { title: 'Did you know you can install Weavly?', body: 'Add Weavly to your phone or desktop for a smoother, app-like experience. Open it straight from your home screen or computer.', how: 'See how', later: 'Not now', never: 'Don’t show me again' },
    hi: { title: 'क्या आप जानते हैं कि Weavly इंस्टॉल कर सकते हैं?', body: 'ऐप जैसा बेहतर अनुभव पाने के लिए Weavly को अपने फ़ोन या कंप्यूटर पर जोड़ें। इसे सीधे होम स्क्रीन या कंप्यूटर से खोलें।', how: 'तरीका देखें', later: 'अभी नहीं', never: 'दोबारा न दिखाएँ' },
    gu: { title: 'શું તમે જાણો છો કે Weavly ઇન્સ્ટોલ કરી શકો છો?', body: 'ઍપ જેવો સરળ અનુભવ મેળવવા Weavly તમારા ફોન કે કમ્પ્યુટર પર ઉમેરો. તેને સીધું હોમ સ્ક્રીન કે કમ્પ્યુટર પરથી ખોલો.', how: 'રીત જુઓ', later: 'હમણાં નહીં', never: 'ફરી બતાવશો નહીં' },
}

export function PwaInstallNudge() {
    const pathname = usePathname()
    const { language } = useTranslation()
    const [visible, setVisible] = useState(false)
    const workspace = pathname.startsWith('/owner/')
    const text = copy[language]

    useEffect(() => {
        if (!workspace) return
        const displayMode = window.matchMedia('(display-mode: standalone)')
        const isInstalled = () => displayMode.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
        let timer: ReturnType<typeof setTimeout> | undefined

        const dismissInstalled = () => {
            setVisible(false)
            try {
                localStorage.setItem(PWA_NUDGE_STORAGE_KEY, JSON.stringify({ dismissed: true, lastShownAt: Date.now() }))
            } catch { /* Storage availability must never interrupt the workspace. */ }
        }
        const check = () => {
            clearTimeout(timer)
            if (document.visibilityState !== 'visible') return
            if (isInstalled()) {
                dismissInstalled()
                return
            }
            // Give the workspace time to settle; do not interrupt sign-in.
            timer = setTimeout(() => {
                if (document.visibilityState !== 'visible' || isInstalled()) return
                try {
                    const now = Date.now()
                    if (!isPwaNudgeDue(readPwaNudgePreference(localStorage.getItem(PWA_NUDGE_STORAGE_KEY)), now)) return
                    // Record the impression before showing, including when the user takes no action.
                    localStorage.setItem(PWA_NUDGE_STORAGE_KEY, JSON.stringify({ dismissed: false, lastShownAt: now }))
                    setVisible(true)
                } catch { /* Skip the nudge if its frequency cannot be remembered. */ }
            }, 8000)
        }
        const onStorage = (event: StorageEvent) => {
            if (event.key === PWA_NUDGE_STORAGE_KEY) setVisible(false)
        }
        check()
        document.addEventListener('visibilitychange', check)
        window.addEventListener('appinstalled', dismissInstalled)
        window.addEventListener('storage', onStorage)
        displayMode.addEventListener('change', check)
        return () => {
            clearTimeout(timer)
            document.removeEventListener('visibilitychange', check)
            window.removeEventListener('appinstalled', dismissInstalled)
            window.removeEventListener('storage', onStorage)
            displayMode.removeEventListener('change', check)
        }
    }, [workspace])

    function dismissForever() {
        try {
            localStorage.setItem(PWA_NUDGE_STORAGE_KEY, JSON.stringify({ dismissed: true, lastShownAt: Date.now() }))
        } catch { /* Still dismiss for this session if storage becomes unavailable. */ }
        setVisible(false)
    }

    if (!workspace || !visible) return null

    return (
        <aside aria-labelledby="pwa-nudge-title" data-mobile-install-nudge="true" data-i18n-skip="true" className="fixed inset-x-3 bottom-[calc(var(--mobile-nav-height,80px)+12px)] z-40 max-h-[60svh] overflow-y-auto rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:left-auto sm:right-6 sm:w-96 md:bottom-6">
            <button type="button" onClick={() => setVisible(false)} aria-label={text.later} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted">
                <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <Download className="mb-3 h-6 w-6 text-primary" aria-hidden="true" />
            <h2 id="pwa-nudge-title" className="pr-7 text-base font-semibold">{text.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{text.body}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link href="/install" onClick={() => setVisible(false)} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">{text.how}</Link>
                <button type="button" onClick={() => setVisible(false)} className="min-h-11 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted">{text.later}</button>
            </div>
            <button type="button" onClick={dismissForever} className="mt-2 min-h-11 rounded px-1 py-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">{text.never}</button>
        </aside>
    )
}
