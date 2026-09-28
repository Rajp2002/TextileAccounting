import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { getCurrentSuratYear } from '@/lib/time'
import { LEGAL_OPERATOR } from '@/lib/legal-operator'
import s from './landing.module.css'

const footerSections = [
    {
        title: 'Product',
        links: [
            { name: 'The cost stack', href: '/#product' },
            { name: 'Enquiry to pay slip', href: '/#workflow' },
            { name: 'Plans', href: '/#plans' },
            { name: 'Pricing', href: '/#pricing' },
        ]
    },
    {
        title: 'Resources',
        links: [
            { name: 'Questions', href: '/#faq' },
            { name: 'Install Weavly', href: '/install' },
            { name: 'Log in to your workspace', href: '/login' },
            { name: 'Start with Free', href: '/signup?plan=free' },
        ]
    },
    {
        title: 'Legal',
        links: [
            { name: 'Privacy Policy', href: '/privacy' },
            { name: 'Privacy Request', href: '/privacy-request' },
            { name: 'Report Security Incident', href: '/security-incident' },
            { name: 'Terms of Service', href: '/terms' },
            { name: 'Refund Policy', href: '/refund-policy' },
        ]
    }
]

/** Also used by /privacy-request, so it carries its own colours instead of relying on the landing page. */
export default function LandingFooter() {
    return (
        <footer className={cn(s.page, s.onLoom, 'w-full px-3 xs:px-4 sm:px-6 lg:px-8')}>
            <div className={cn(s.warp, 'mx-auto max-w-7xl border-t border-[color:var(--lp-loom-line)]')}>
                <div className="grid gap-12 px-4 pb-10 pt-14 xs:px-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)] md:px-8 lg:px-10">
                    <div className="min-w-0">
                        <Link href="/" aria-label="Weavly home" className="relative block h-14 w-36 transition-opacity hover:opacity-80">
                            <Image src="/images/WeavlyLogo.png" alt="" fill sizes="9rem" className="object-contain object-left" />
                        </Link>
                        <p className="mt-4 max-w-[20rem] text-[14px] leading-6 text-[color:var(--lp-on-loom-muted)]">
                            Costing and factory records for grey-fabric weaving units. Free, Lite and Base.
                        </p>
                        <p className="mt-5 text-[14px] leading-6 text-[color:var(--lp-on-loom-muted)]">
                            Contact{' '}
                            <a href={`mailto:${LEGAL_OPERATOR.contactEmail}`} className="font-semibold text-[color:var(--lp-on-loom)] underline decoration-[color:var(--lp-on-loom-muted)] underline-offset-4 hover:decoration-[color:var(--lp-saffron)]">
                                {LEGAL_OPERATOR.contactEmail}
                            </a>
                        </p>
                    </div>

                    <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
                        {footerSections.map((section) => (
                            <div key={section.title} className="min-w-0">
                                <h2 className={cn(s.label, 'text-[color:var(--lp-on-loom-muted)]')}>{section.title}</h2>
                                <ul className="mt-4 grid list-none gap-1">
                                    {section.links.map((link) => (
                                        <li key={link.name}>
                                            <Link href={link.href} className="inline-flex min-h-[44px] items-center md:min-h-[36px] text-[14px] text-[color:var(--lp-on-loom)] transition-colors hover:text-white hover:underline hover:decoration-[color:var(--lp-saffron)] hover:underline-offset-4">
                                                {link.name}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </nav>
                </div>

                <div className="flex flex-col gap-2 border-t border-[color:var(--lp-loom-line)] px-4 py-6 text-[13px] text-[color:var(--lp-on-loom-muted)] xs:px-5 sm:flex-row sm:items-center sm:justify-between md:px-8 lg:px-10">
                    <p>&copy; {getCurrentSuratYear()} Weavly. All rights reserved.</p>
                    <p>Made for textile costing in India.</p>
                </div>
            </div>
        </footer>
    )
}
