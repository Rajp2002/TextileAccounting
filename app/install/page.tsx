import type { Metadata } from 'next'
import Link from 'next/link'
import { Download, Monitor, Smartphone } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Install Weavly | Desktop & Mobile Guide',
    description: 'Install Weavly on Android, iPhone, iPad, Windows, or Mac with this step-by-step guide.',
}

const guides = [
    {
        id: 'android', title: 'Android phone or tablet', browser: 'Google Chrome', icon: Smartphone,
        steps: [
            'Open the Weavly website in Chrome. If you received a link in WhatsApp or another app, copy it into Chrome first.',
            'Tap the three-dot menu (⋮), then Add to home screen → Install. Some versions show Install app directly.',
            'Confirm Install and follow any on-screen instructions.',
            'Open Weavly from your home screen or app drawer and sign in if asked.',
        ],
        source: 'https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en',
    },
    {
        id: 'iphone', title: 'iPhone or iPad', browser: 'Safari', icon: Smartphone,
        steps: [
            'Open the Weavly website in Safari.',
            'Tap Share (the square with an upward arrow). Depending on your Safari layout, open the More (…) menu to find Share.',
            'Scroll down and tap Add to Home Screen. If it is missing, use Edit Actions to add it.',
            'Keep the name Weavly, turn on Open as Web App if shown, and tap Add.',
            'Tap the Weavly icon on your Home Screen and sign in if asked.',
        ],
        source: 'https://support.apple.com/guide/iphone/iphea86e5236/ios',
    },
    {
        id: 'desktop', title: 'Windows, Mac, or Chromebook', browser: 'Google Chrome or Microsoft Edge', icon: Monitor,
        steps: [
            'Open the Weavly website in Chrome or Edge.',
            'Click the install icon on the right side of the address bar, if available.',
            'In Chrome, you can also open the three-dot menu → Cast, save, and share → Install page as app. In Edge, open Settings and more (…) → More tools → Apps → Install this site as an app. Menu names can vary by version.',
            'Confirm Install. Open Weavly from your computer’s app launcher or shortcut, and sign in if asked.',
        ],
        source: 'https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DDesktop&hl=en',
    },
    {
        id: 'mac', title: 'Mac with Safari', browser: 'macOS Sonoma 14 or later', icon: Monitor,
        steps: [
            'Open the Weavly website in Safari.',
            'Choose File → Add to Dock, or click Share → Add to Dock.',
            'Keep the name Weavly and click Add.',
            'Open Weavly from the Dock or Applications folder and sign in if asked.',
        ],
        source: 'https://support.apple.com/en-us/104996',
    },
]

export default function InstallPage() {
    return (
        <main className="safe-area-page min-h-svh bg-background text-foreground [--page-gutter-x:1rem] [--page-gutter-y:2rem] sm:[--page-gutter-x:1.5rem] sm:[--page-gutter-y:3rem]">
            <div className="mx-auto max-w-4xl">
                <nav aria-label="Guide navigation" className="mb-10 flex items-center justify-between gap-4 text-sm font-semibold">
                    <Link href="/" className="rounded px-2 py-3 hover:underline">Weavly home</Link>
                    <Link href="/login" className="rounded px-2 py-3 hover:underline">Open Weavly</Link>
                </nav>
                <header className="mb-8">
                    <Download className="mb-4 h-8 w-8 text-primary" aria-hidden="true" />
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Install Weavly on your device</h1>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">Add Weavly to your home screen or computer and open it like an app. This is a Progressive Web App (PWA); you install it directly from your browser.</p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">Use the same Weavly website address you normally use to sign in. Install on each device separately, then use your existing account.</p>
                </header>
                <nav aria-label="Choose your device" className="mb-8 flex flex-wrap gap-2">
                    {guides.map(guide => <a key={guide.id} href={`#${guide.id}`} className="rounded-full border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted">{guide.id === 'iphone' ? 'iPhone / iPad' : guide.id === 'desktop' ? 'Desktop' : guide.id === 'mac' ? 'Mac Safari' : 'Android'}</a>)}
                </nav>
                <div className="grid gap-5 md:grid-cols-2">
                    {guides.map(({ id, title, browser, icon: Icon, steps, source }) => (
                        <section key={id} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
                            <Icon className="mb-3 h-6 w-6 text-primary" aria-hidden="true" />
                            <h2 id={`${id}-title`} className="text-xl font-semibold">{title}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">{browser}</p>
                            <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-6">
                                {steps.map(step => <li key={step} className="pl-1">{step}</li>)}
                            </ol>
                            <a href={source} className="mt-5 inline-block text-sm underline underline-offset-4">Official browser instructions</a>
                            {id === 'desktop' && <a href="https://support.microsoft.com/en-US/edge/install-manage-or-uninstall-apps-in-microsoft-edge" className="mt-2 block text-sm underline underline-offset-4">Microsoft Edge instructions</a>}
                        </section>
                    ))}
                </div>
                <section aria-labelledby="install-help" className="mt-8 rounded-2xl border border-border p-5 sm:p-6">
                    <h2 id="install-help" className="text-xl font-semibold">Cannot find the install option?</h2>
                    <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
                        <li>Use a regular browser window, outside private or incognito mode. Open links from messaging apps in Chrome or Safari.</li>
                        <li>Check your home screen or app launcher: Weavly may already be installed.</li>
                        <li>Update your browser and reload the website while online. On iPhone or iPad, use Safari’s Add to Home Screen steps above.</li>
                        <li>If installation is unavailable on your browser or a managed work device, you can continue using Weavly in the browser.</li>
                    </ul>
                    <p className="mt-5 text-sm leading-6"><strong>Stay connected:</strong> Installing does not make every feature work offline. Saving costings, exporting Cost Sheets, and syncing data require an internet connection.</p>
                </section>
            </div>
        </main>
    )
}
