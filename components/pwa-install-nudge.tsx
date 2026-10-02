'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Download, X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { useMobileKeyboard } from '@/hooks/use-mobile-keyboard'
import { getMobileKeyboardSnapshot } from '@/lib/mobile-viewport'
import { createPwaInstallCoordinator, isPwaInstallWorkspace, PWA_NUDGE_STORAGE_KEY, readPwaNudgePreference, requestPwaInstallation, type PwaInstallCoordinator, type PwaInstallPrompt } from '@/lib/pwa-install-nudge'
import { isPwaInstallBlocked, PWA_INSTALL_SAFETY_EVENT, PWA_SUCCESSFUL_WORKFLOWS, PWA_WORKFLOW_SUCCESS_EVENT, type PwaSuccessfulWorkflow } from '@/lib/pwa-workflow-success'

const copy = {
    en: {
        title: 'Keep Weavly on your home screen', body: 'Open your workspace in one tap, with more room for your work.',
        install: 'Install Weavly', installing: 'Opening installer…', how: 'Installation guide', later: 'Not now', never: 'Don’t show me again',
        ios: 'On iPhone or iPad, open Weavly in Safari. Tap Share, then Add to Home Screen.',
        android: 'In your browser menu, choose Install app or Add to Home screen. If it is missing, open Weavly in Chrome.',
        desktop: 'Open your browser menu and choose Install Weavly or Install this site as an app. The guide has steps for other browsers.',
        unavailable: 'Your browser did not open the installer. You can use these steps instead.',
    },
    hi: {
        title: 'Weavly को होम स्क्रीन पर रखें', body: 'एक टैप में अपना काम खोलें और काम के लिए अधिक जगह पाएँ।',
        install: 'Weavly इंस्टॉल करें', installing: 'इंस्टॉलर खोल रहे हैं…', how: 'इंस्टॉल करने की जानकारी', later: 'अभी नहीं', never: 'दोबारा न दिखाएँ',
        ios: 'iPhone या iPad पर Weavly को Safari में खोलें। Share पर टैप करें, फिर Add to Home Screen चुनें।',
        android: 'ब्राउज़र मेन्यू में Install app या Add to Home screen चुनें। विकल्प न मिले तो Weavly को Chrome में खोलें।',
        desktop: 'ब्राउज़र मेन्यू में Install Weavly या Install this site as an app चुनें। दूसरे ब्राउज़र के लिए गाइड देखें।',
        unavailable: 'ब्राउज़र ने इंस्टॉलर नहीं खोला। नीचे दिए तरीके से इंस्टॉल कर सकते हैं।',
    },
    gu: {
        title: 'Weavlyને હોમ સ્ક્રીન પર રાખો', body: 'એક ટૅપમાં તમારું કામ ખોલો અને કામ માટે વધુ જગ્યા મેળવો.',
        install: 'Weavly ઇન્સ્ટોલ કરો', installing: 'ઇન્સ્ટોલર ખોલી રહ્યા છીએ…', how: 'ઇન્સ્ટોલ કરવાની માર્ગદર્શિકા', later: 'હમણાં નહીં', never: 'ફરી બતાવશો નહીં',
        ios: 'iPhone અથવા iPad પર Weavlyને Safariમાં ખોલો. Share પર ટૅપ કરો, પછી Add to Home Screen પસંદ કરો.',
        android: 'બ્રાઉઝર મેનૂમાં Install app અથવા Add to Home screen પસંદ કરો. વિકલ્પ ન મળે તો Weavlyને Chromeમાં ખોલો.',
        desktop: 'બ્રાઉઝર મેનૂમાં Install Weavly અથવા Install this site as an app પસંદ કરો. અન્ય બ્રાઉઝર માટે માર્ગદર્શિકા જુઓ.',
        unavailable: 'બ્રાઉઝરે ઇન્સ્ટોલર ખોલ્યું નથી. નીચે આપેલા પગલાંથી ઇન્સ્ટોલ કરી શકો છો.',
    },
}

function platform() {
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
    return /Android/i.test(navigator.userAgent) ? 'android' : 'desktop'
}

function isEditingOrDialogOpen() {
    const focused = document.activeElement
    const editing = focused instanceof HTMLElement && (focused.isContentEditable || focused.matches('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea, select'))
    return editing || Boolean(document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], dialog[open], [aria-modal="true"]:not([data-state="closed"])'))
}

export function PwaInstallNudge() {
    const pathname = usePathname()
    const { language } = useTranslation()
    const keyboardVisible = useMobileKeyboard()
    const [visible, setVisible] = useState(false)
    const [nativePrompt, setNativePrompt] = useState<PwaInstallPrompt | null>(null)
    const [installing, setInstalling] = useState(false)
    const [unavailable, setUnavailable] = useState(false)
    const [device, setDevice] = useState<'ios' | 'android' | 'desktop'>('desktop')
    const coordinator = useRef<PwaInstallCoordinator | null>(null)
    const card = useRef<HTMLElement>(null)
    const mounted = useRef(false)
    const installingRef = useRef(false)
    const workspace = isPwaInstallWorkspace(pathname)
    const text = copy[language]

    useEffect(() => {
        mounted.current = true
        const displayMode = window.matchMedia('(display-mode: standalone)')
        const isInstalled = () => displayMode.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
        const controller = createPwaInstallCoordinator({
            canShow: () => isPwaInstallWorkspace(window.location.pathname)
                && document.visibilityState === 'visible' && !isInstalled()
                && !getMobileKeyboardSnapshot() && !isEditingOrDialogOpen() && !isPwaInstallBlocked(),
            readPreference: () => readPwaNudgePreference(localStorage.getItem(PWA_NUDGE_STORAGE_KEY)),
            writePreference: preference => localStorage.setItem(PWA_NUDGE_STORAGE_KEY, JSON.stringify(preference)),
            onVisibility: value => { if (value) setDevice(platform()); setVisible(value) },
        })
        coordinator.current = controller
        const dismissInstalled = () => {
            setNativePrompt(null)
            controller.dismissForever()
        }
        const recheck = () => { if (isInstalled()) dismissInstalled(); else controller.recheck() }
        // Capture once for the provider lifetime, even before entering a workspace.
        const beforeInstall = (event: Event) => {
            const prompt = event as PwaInstallPrompt
            if (typeof prompt.prompt !== 'function' || !prompt.userChoice) return
            event.preventDefault()
            setNativePrompt(prompt)
            setUnavailable(false)
        }
        const success = (event: Event) => {
            const workflow = (event as CustomEvent<{ workflow?: PwaSuccessfulWorkflow }>).detail?.workflow
            if (workflow && PWA_SUCCESSFUL_WORKFLOWS.includes(workflow) && isPwaInstallWorkspace(window.location.pathname)) controller.workflowSucceeded()
        }
        const onStorage = (event: StorageEvent) => { if (event.key === PWA_NUDGE_STORAGE_KEY) controller.interrupt() }
        const dirtyInteraction = () => controller.interrupt()
        const observer = new MutationObserver(recheck)
        observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state', 'aria-hidden', 'aria-modal', 'open', 'inert', 'disabled'] })
        window.addEventListener('beforeinstallprompt', beforeInstall)
        window.addEventListener('appinstalled', dismissInstalled)
        window.addEventListener('storage', onStorage)
        window.addEventListener(PWA_WORKFLOW_SUCCESS_EVENT, success)
        window.addEventListener(PWA_INSTALL_SAFETY_EVENT, recheck)
        document.addEventListener('visibilitychange', recheck)
        document.addEventListener('focusin', recheck)
        document.addEventListener('focusout', recheck)
        document.addEventListener('pointerdown', recheck, { passive: true })
        document.addEventListener('input', dirtyInteraction, true)
        document.addEventListener('change', dirtyInteraction, true)
        displayMode.addEventListener('change', recheck)
        if (isInstalled()) dismissInstalled()
        return () => {
            mounted.current = false
            coordinator.current = null
            controller.dispose()
            observer.disconnect()
            window.removeEventListener('beforeinstallprompt', beforeInstall)
            window.removeEventListener('appinstalled', dismissInstalled)
            window.removeEventListener('storage', onStorage)
            window.removeEventListener(PWA_WORKFLOW_SUCCESS_EVENT, success)
            window.removeEventListener(PWA_INSTALL_SAFETY_EVENT, recheck)
            document.removeEventListener('visibilitychange', recheck)
            document.removeEventListener('focusin', recheck)
            document.removeEventListener('focusout', recheck)
            document.removeEventListener('pointerdown', recheck)
            document.removeEventListener('input', dirtyInteraction, true)
            document.removeEventListener('change', dirtyInteraction, true)
            displayMode.removeEventListener('change', recheck)
        }
    }, [])

    useEffect(() => {
        if (!workspace) coordinator.current?.interrupt()
        else coordinator.current?.recheck()
    }, [pathname, workspace, keyboardVisible])

    useEffect(() => {
        const element = card.current
        if (!visible || !element) return
        // Count only an actually visible card, after render, never a scheduled reminder.
        if (typeof IntersectionObserver !== 'undefined') {
            const observer = new IntersectionObserver(entries => {
                if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5) && coordinator.current?.confirmVisible()) observer.disconnect()
            }, { threshold: 0.5 })
            observer.observe(element)
            return () => observer.disconnect()
        }
        const frame = requestAnimationFrame(() => {
            const bounds = element.getBoundingClientRect()
            if (bounds.height > 0 && bounds.bottom > 0 && bounds.top < window.innerHeight) coordinator.current?.confirmVisible()
        })
        return () => cancelAnimationFrame(frame)
    }, [visible])

    function dismiss() {
        coordinator.current?.confirmVisible()
        coordinator.current?.interrupt()
    }
    async function install() {
        if (!nativePrompt || installingRef.current) return
        const prompt = nativePrompt
        setNativePrompt(null)
        installingRef.current = true
        setInstalling(true)
        const outcome = await requestPwaInstallation(prompt)
        installingRef.current = false
        if (!mounted.current) return
        setInstalling(false)
        if (outcome === 'unavailable') setUnavailable(true)
        else dismiss() // accepted is not proof of installation; wait for appinstalled.
    }

    if (!workspace || !visible || keyboardVisible) return null
    return (
        <aside ref={card} aria-labelledby="pwa-nudge-title" data-mobile-install-nudge="true" data-i18n-skip="true" className="fixed inset-x-3 bottom-[calc(var(--mobile-nav-height,80px)+12px)] z-40 max-h-[60svh] overflow-y-auto rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xs sm:left-auto sm:right-6 sm:w-96 md:bottom-6">
            <button type="button" onClick={dismiss} aria-label={text.later} className="absolute right-1 top-1 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg hover:bg-muted"><X className="h-4 w-4" aria-hidden="true" /></button>
            <h2 id="pwa-nudge-title" className="pr-8 text-base font-semibold">{text.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text.body}</p>
            {unavailable && <p role="status" className="mt-2 text-sm">{text.unavailable}</p>}
            {!nativePrompt && !installing && <p className="mt-2 text-sm leading-relaxed">{text[device]}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
                {(nativePrompt || installing) && <button type="button" onClick={() => void install()} disabled={installing} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"><Download className="h-4 w-4" aria-hidden="true" />{installing ? text.installing : text.install}</button>}
                {!nativePrompt && !installing && <Link href="/install" onClick={dismiss} className="inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{text.how}</Link>}
                <button type="button" onClick={dismiss} className="min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted">{text.later}</button>
            </div>
            <button type="button" onClick={() => coordinator.current?.dismissForever()} className="mt-1 min-h-[44px] rounded px-1 py-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">{text.never}</button>
        </aside>
    )
}
