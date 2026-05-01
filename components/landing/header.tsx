'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function LandingHeader() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    const navLinks = [
        { name: 'Features', href: '#features' },
        { name: 'Pricing', href: '#pricing' },
        { name: 'FAQ', href: '#faq' },
    ]

    return (
        <motion.header
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="fixed top-0 left-0 right-0 z-50 pt-0 px-4 pb-4 sm:px-6 lg:px-8"
        >
            <div className="mx-auto max-w-7xl">
                <div className="rounded-b-[2rem] border border-t-0 border-white/20 bg-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 transition-all dark:bg-zinc-950/60 dark:border-white/10 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)]">
                    <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
                    <Link href="/" className="flex items-center group">
                            <div className="relative h-16 w-40 sm:h-20 sm:w-56 group-hover:opacity-80 transition-opacity duration-200">
                                <Image src="/images/WeavlyLogo.png" alt="Weavly Logo" fill className="object-contain object-left" priority />
                            </div>
                        </Link>

                        {/* Desktop Nav */}
                        <nav className="hidden md:flex items-center gap-8">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className="relative text-sm font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors group"
                                >
                                    {link.name}
                                    <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-amber-500 to-orange-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left rounded-full" />
                                </Link>
                            ))}
                        </nav>

                        <div className="hidden md:flex items-center gap-4">
                            <Link href="/login">
                                <Button variant="ghost" className="text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-zinc-800/50 font-semibold rounded-full px-6 transition-all">
                                    Log in
                                </Button>
                            </Link>
                            <Link href="/signup">
                                <Button className="bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 shadow-lg shadow-gray-900/10 dark:shadow-white/10 transition-all hover:scale-105 rounded-full px-6 font-semibold">
                                    Sign Up
                                </Button>
                            </Link>
                        </div>

                        {/* Mobile Menu Toggle */}
                        <div className="flex md:hidden">
                            <button
                                type="button"
                                className="-m-2.5 inline-flex items-center justify-center rounded-full p-2.5 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800/50 transition-colors"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            >
                                <span className="sr-only">Open main menu</span>
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
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute top-24 left-4 right-4 z-50 md:hidden"
                        >
                            <div className="overflow-hidden rounded-3xl bg-white/95 shadow-2xl ring-1 ring-gray-900/5 backdrop-blur-2xl dark:bg-zinc-900/95 dark:ring-zinc-800">
                                <div className="p-5 space-y-4">
                                    {navLinks.map((link) => (
                                        <Link
                                            key={link.name}
                                            href={link.href}
                                            className="block text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50/80 rounded-xl px-4 py-3 dark:text-white dark:hover:bg-zinc-800/80 transition-colors"
                                            onClick={() => setMobileMenuOpen(false)}
                                        >
                                            {link.name}
                                        </Link>
                                    ))}
                                    <div className="h-px bg-gray-100 dark:bg-zinc-800 my-2" />
                                    <div className="flex flex-col gap-3">
                                        <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                                            <Button variant="outline" className="w-full rounded-2xl py-6 font-semibold border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-900 dark:text-white">Log in</Button>
                                        </Link>
                                        <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                                            <Button className="w-full bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:opacity-90 rounded-2xl py-6 font-semibold shadow-md">Sign Up</Button>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.header>
    )
}
