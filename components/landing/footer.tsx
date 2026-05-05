'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { Plus, Minus, Twitter, Linkedin, Facebook } from 'lucide-react'

const footerSections = [
    {
        title: 'Product',
        links: [
            { name: 'Features', href: '/#features' },
            { name: 'Pricing', href: '/#pricing' },
            { name: 'Production Tracking', href: '/#features' },
            { name: 'Payroll Engine', href: '/#features' },
        ]
    },
    {
        title: 'Resources',
        links: [
            { name: 'FAQ', href: '/#faq' },
            { name: 'Help Center', href: '#' },
            { name: 'Owner Dashboard', href: '/login' },
            { name: 'Supervisor App', href: '/join' },
        ]
    },
    {
        title: 'Legal',
        links: [
            { name: 'Privacy Policy', href: '/privacy' },
            { name: 'Terms of Service', href: '/terms' },
            { name: 'Refund Policy', href: '/refund-policy' },
        ]
    }
]

export default function LandingFooter() {
    // Keeps track of which accordion is open on mobile
    const [openSection, setOpenSection] = useState<string | null>(null)

    return (
        <div className="snap-end shrink-0 w-full relative z-10">
            <footer className="bg-zinc-950 pt-16 pb-8 px-6 border-t border-white/10 text-white w-full">
                <div className="mx-auto max-w-7xl">
                    {/* Top part: grid on desktop, flex-col on mobile */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 mb-16">
                        
                        {/* Column 1: Brand */}
                        <div className="col-span-1 md:col-span-1 flex flex-col items-center md:items-start text-center md:text-left">
                            <Link href="/">
                                <div className="relative h-14 w-36 mb-4 hover:opacity-80 transition-opacity">
                                    <Image src="/images/WeavlyLogo.png" alt="Weavly Logo" fill sizes="9rem" className="object-contain object-center md:object-left" />
                                </div>
                            </Link>
                            <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-xs cursor-default">
                                Empowering Indian textile manufacturers with complete production, payroll, and order management tools.
                            </p>
                            <div className="flex gap-4">
                                <a href="#" className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 hover:text-amber-500 text-gray-400 transition-colors">
                                    <Twitter className="h-5 w-5" />
                                    <span className="sr-only">Twitter</span>
                                </a>
                                <a href="#" className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 hover:text-amber-500 text-gray-400 transition-colors">
                                    <Linkedin className="h-5 w-5" />
                                    <span className="sr-only">LinkedIn</span>
                                </a>
                                <a href="#" className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 hover:text-amber-500 text-gray-400 transition-colors">
                                    <Facebook className="h-5 w-5" />
                                    <span className="sr-only">Facebook</span>
                                </a>
                            </div>
                        </div>

                        {/* Column 2-4: Sections */}
                        <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                            {footerSections.map((section) => (
                                <div key={section.title} className="w-full">
                                    
                                    {/* Desktop View: Uncollapsible Headers */}
                                    <h3 className="hidden md:block font-semibold text-white mb-6 tracking-wide">
                                        {section.title}
                                    </h3>
                                    
                                    {/* Mobile View: Collapsible Accordion Header */}
                                    <button 
                                        className="md:hidden w-full flex items-center justify-between py-4 border-b border-white/5 font-semibold text-white text-left tracking-wide"
                                        onClick={() => setOpenSection(openSection === section.title ? null : section.title)}
                                    >
                                        {section.title}
                                        {openSection === section.title ? (
                                            <Minus className="h-5 w-5 text-gray-400" />
                                        ) : (
                                            <Plus className="h-5 w-5 text-gray-400" />
                                        )}
                                    </button>

                                    {/* Desktop List */}
                                    <ul className="hidden md:flex flex-col space-y-4">
                                        {section.links.map((link) => (
                                            <li key={link.name}>
                                                <Link 
                                                    href={link.href} 
                                                    className="text-gray-400 hover:text-white transition-colors text-sm"
                                                >
                                                    {link.name}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Mobile Collapsible List */}
                                    {openSection === section.title && (
                                        <div className="md:hidden overflow-hidden">
                                            <ul className="flex flex-col space-y-4 py-4 px-2">
                                                {section.links.map((link) => (
                                                    <li key={link.name}>
                                                        <Link
                                                            href={link.href}
                                                            className="text-gray-400 hover:text-white transition-colors text-sm"
                                                        >
                                                            {link.name}
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom border + Copyright */}
                    <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-gray-400 text-sm">
                            &copy; {new Date().getFullYear()} Weavly. All rights reserved.
                        </p>
                        <div className="flex items-center gap-6 text-sm text-gray-500">
                            <span>Built securely for the Indian textile industry.</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    )
}
