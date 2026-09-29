'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export default function LandingHeader() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false)
    const previousScrollTop = useRef(0)
    const directionDistance = useRef(0)

    const navLinks = [
        { name: 'Product', href: '#product' },
        { name: 'Workflow', href: '#workflow' },
        { name: 'Plans', href: '#plans' },
        { name: 'Pricing', href: '#pricing' },
        { name: 'FAQ', href: '#faq' },
    ]

    useEffect(() => {
        const scrollContainer = document.querySelector<HTMLElement>('.landing-scroll')
        const mobileQuery = window.matchMedia('(max-width: 767px)')

        if (!scrollContainer) return

        const handleScroll = () => {
            if (!mobileQuery.matches || mobileMenuOpen) {
                setIsHeaderCollapsed(false)
                previousScrollTop.current = scrollContainer.scrollTop
                directionDistance.current = 0
                return
            }

            const currentScrollTop = Math.max(0, scrollContainer.scrollTop)
            const delta = currentScrollTop - previousScrollTop.current

            if (currentScrollTop < 24) {
                setIsHeaderCollapsed(false)
                directionDistance.current = 0
            } else if (delta > 0) {
                directionDistance.current = Math.max(0, directionDistance.current) + delta
                if (directionDistance.current >= 12) setIsHeaderCollapsed(true)
            } else if (delta < 0) {
                directionDistance.current = Math.min(0, directionDistance.current) + delta
                if (directionDistance.current <= -8) setIsHeaderCollapsed(false)
            }

            previousScrollTop.current = currentScrollTop
        }

        const handleViewportChange = () => {
            if (!mobileQuery.matches) setIsHeaderCollapsed(false)
            previousScrollTop.current = scrollContainer.scrollTop
            directionDistance.current = 0
        }

        previousScrollTop.current = scrollContainer.scrollTop
        scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
        mobileQuery.addEventListener('change', handleViewportChange)

        return () => {
            scrollContainer.removeEventListener('scroll', handleScroll)
            mobileQuery.removeEventListener('change', handleViewportChange)
        }
    }, [mobileMenuOpen])

    return (
        <header
            className={`fixed left-0 right-0 top-0 z-50 px-3 pb-3 pt-safe transition-transform duration-300 ease-out xs:px-4 xs:pb-4 sm:px-6 lg:px-8 ${
                isHeaderCollapsed ? '-translate-y-full' : 'translate-y-0'
            }`}
        >
            <div className="mx-auto max-w-7xl">
                <div data-weavly-intro-panel className="rounded-b-xl border border-t-0 border-wv-border-inverse bg-black shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-300 ease-out">
                    <div className="flex min-w-0 items-center justify-between px-3 py-2 xs:px-4 xs:py-3 md:px-6 lg:px-8">
                        <Link href="/" className="group flex items-center">
                            <div data-weavly-intro-target="landing" className="relative h-12 w-32 transition-opacity duration-200 group-hover:opacity-80 xs:h-16 xs:w-40 md:h-20 md:w-56">
                                <Image src="/images/WeavlyLogo.png" alt="Weavly Logo" fill sizes="(max-width: 640px) 10rem, 14rem" className="origin-left scale-110 object-contain object-left" priority />
                            </div>
                        </Link>

                        {/* Desktop Nav */}
                        <nav className="hidden items-center gap-6 lg:flex xl:gap-8">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className="relative text-sm font-semibold text-wv-text-inverse-secondary hover:text-wv-text-inverse transition-colors group"
                                >
                                    {link.name}
                                    <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-saffron scale-x-0 group-hover:scale-x-100 transition-transform origin-left rounded-full" />
                                </Link>
                            ))}
                        </nav>

                        <div className="hidden items-center gap-3 lg:flex xl:gap-4">
                            <Link href="/login">
                                <Button variant="ghost" className="text-wv-text-inverse-secondary hover:text-wv-text-inverse hover:bg-surface/10 font-semibold rounded-full px-6 transition-all">
                                    Log in
                                </Button>
                            </Link>
                            <Link href="/signup?plan=free">
                                <Button className="bg-saffron hover:bg-wv-action-accent-hover text-ink shadow-xs rounded-md px-6 font-semibold focus-visible:ring-wv-border-focus-inverse transition-all">
                                    Start with Free
                                </Button>
                            </Link>
                        </div>

                        {/* Mobile Menu Toggle */}
                        <div className="flex lg:hidden">
                            <button
                                type="button"
                                className="-m-2.5 inline-flex items-center justify-center rounded-full p-2.5 text-wv-text-inverse hover:bg-surface/10 transition-colors"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                aria-expanded={mobileMenuOpen}
                                aria-controls="landing-mobile-menu"
                            >
                                <span className="sr-only">{mobileMenuOpen ? 'Close main menu' : 'Open main menu'}</span>
                                {mobileMenuOpen ? (
                                    <X className="h-6 w-6" aria-hidden="true" />
                                ) : (
                                    <Menu className="h-6 w-6" aria-hidden="true" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div id="landing-mobile-menu" className="mt-2 lg:hidden">
                        <div className="overflow-hidden rounded-xl bg-black/95 shadow-2xl ring-1 ring-wv-border-inverse backdrop-blur-2xl">
                            <div className="p-5 space-y-4">
                                {navLinks.map((link) => (
                                    <Link
                                        key={link.name}
                                        href={link.href}
                                        className="block text-base font-semibold leading-7 text-wv-text-inverse hover:bg-surface/10 rounded-xl px-4 py-3 transition-colors"
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        {link.name}
                                    </Link>
                                ))}
                                <div className="h-px bg-wv-border-inverse my-2" />
                                <div className="flex flex-col gap-3">
                                    <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                                        <Button variant="outline" className="w-full rounded-md py-6 font-semibold border-wv-text-inverse-secondary bg-transparent hover:bg-surface/10 text-wv-text-inverse">Log in</Button>
                                    </Link>
                                    <Link href="/signup?plan=free" onClick={() => setMobileMenuOpen(false)}>
                                        <Button className="w-full bg-saffron hover:bg-wv-action-accent-hover text-ink rounded-md py-6 font-semibold shadow-md focus-visible:ring-wv-border-focus-inverse">Start with Free</Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </header>
    )
}
