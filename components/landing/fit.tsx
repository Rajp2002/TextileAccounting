import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Beam, Eyebrow } from './beam'
import s from './landing.module.css'

// The estimator's own labels, from lib/i18n/base-plan-phrases.ts.
const labels = [
    { lang: 'en', script: '', text: 'Production cost / m', name: 'English' },
    { lang: 'hi', script: s.devanagari, text: 'उत्पादन लागत / मीटर', name: 'हिंदी' },
    { lang: 'gu', script: s.gujarati, text: 'ઉત્પાદન ખર્ચ / મી', name: 'ગુજરાતી' },
]

const facts = [
    {
        title: 'On the phone you already carry',
        copy: (
            <>
                Installs from the browser on Android, iPhone and computers.{' '}
                <Link href="/install" className={s.textLink}>How to install</Link>
            </>
        ),
    },
    {
        title: 'Checked again before it is saved',
        copy: 'The server re-runs every costing in exact decimals. On Lite and Base, a total that differs from your screen is refused.',
    },
    {
        title: 'Yesterday’s costing stays yesterday’s',
        copy: 'Saved costings are versioned snapshots. A new rate never rewrites one you have already sent.',
    },
]

export default function LandingFit() {
    return (
        <Beam tone="deep" labelledBy="fit-title" innerClassName="py-20 sm:py-24 lg:py-28">
            <Eyebrow>Made for the unit</Eyebrow>
            <h2 id="fit-title" className={cn(s.display, 'mt-5 max-w-[40rem] text-[34px] font-semibold leading-[1.05] text-[color:var(--lp-ink)] sm:text-[46px]')}>
                Built for the owner&rsquo;s desk, in the owner&rsquo;s language.
            </h2>

            <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
                <figure className={cn(s.rise, 'min-w-0')}>
                    <ul className="list-none border-t border-[color:var(--lp-ink)]" data-i18n-skip="true">
                        {labels.map((label) => (
                            <li key={label.lang} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-[color:var(--lp-line-strong)] py-5">
                                <span lang={label.lang} className={cn(label.script || s.display, 'text-[28px] font-semibold leading-tight text-[color:var(--lp-ink)] xs:text-[32px] sm:text-[40px]')}>
                                    {label.text}
                                </span>
                                <span lang={label.lang} className={cn(label.lang === 'en' ? s.label : cn(label.script, 'text-[14px]'), 'text-[color:var(--lp-muted)]')}>
                                    {label.name}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <figcaption className="mt-4 max-w-[34rem] text-[15px] leading-[1.6] text-[color:var(--lp-body)]">
                        The same estimator in three languages, on every plan.
                    </figcaption>
                </figure>

                <dl className="grid content-start gap-8">
                    {facts.map((fact) => (
                        <div key={fact.title} className={cn(s.rise, 'border-l-2 border-[color:var(--lp-ink)] pl-5')}>
                            <dt className="text-[17px] font-semibold text-[color:var(--lp-ink)]">{fact.title}</dt>
                            <dd className="mt-2 text-[15px] leading-[1.65] text-[color:var(--lp-body)]">{fact.copy}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </Beam>
    )
}
