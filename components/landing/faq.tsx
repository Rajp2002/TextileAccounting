'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'

const faqs = [
    {
        question: "How does the production tracking work?",
        answer: "Every day, supervisors log the meter production for each worker and machine. The system automatically aggregates these logs, calculates wages based on piece-rates, and prepares the monthly payroll—no more manual tallying or error-prone logbooks."
    },
    {
        question: "Can I use Loomi if my factory has poor internet?",
        answer: "Yes! Loomi is built with 'offline-first' technology. You can log production even when there is no internet connection. The data stays safely on your phone and automatically syncs with our servers as soon as you are back online."
    },
    {
        question: "How do the WhatsApp Daily Briefs work?",
        answer: "Premium users receive an automated summary message on WhatsApp at the end of each day or shift. It gives you a snapshot of total factory production, efficiency, and attendance without you ever needing to open the app."
    },
    {
        question: "Is my factory data secure?",
        answer: "Data security is our priority. We use industry-standard encryption (AES-256) and Row Level Security to ensure that your factory data is isolated and accessible only by you and your authorized staff. We are fully compliant with India's DPDP Act 2023."
    },
    {
        question: "Are your wage calculations legally compliant?",
        answer: "Yes. Our payroll engine automatically respects India's Code on Wages, including rules on minimum wage alerts and the 50% cap on salary deductions for advances (Upaad), keeping your factory audit-ready at all times."
    },
    {
        question: "How do I upgrade from the Base to the Premium plan?",
        answer: "You can upgrade anytime from your Owner Dashboard settings. The system will handle the transition smoothly, unlocking features like WhatsApp Briefs and support for unlimited workers instantly."
    }
]

export default function LandingFAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(null)

    return (
        <section className="bg-white py-16 sm:py-24 dark:bg-zinc-950 relative overflow-hidden" id="faq">
            {/* Background Accent */}
            <div className="absolute bottom-0 right-0 w-[40rem] h-[40rem] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none translate-x-1/2 translate-y-1/2" />

            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="mx-auto max-w-2xl text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-sm font-bold leading-7 text-amber-700 dark:text-amber-500 tracking-widest uppercase">FAQ</h2>
                        <p className="mt-2 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
                            Common Questions
                        </p>
                        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
                            Everything you need to know about about the Loomi platform and how it helps your textile business.
                        </p>
                    </motion.div>
                </div>

                <div className="mx-auto mt-16 max-w-3xl">
                    <div className="space-y-4">
                        {faqs.map((faq, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.3, delay: index * 0.1 }}
                                className="rounded-3xl border border-gray-100 bg-white/50 backdrop-blur-sm dark:border-white/5 dark:bg-zinc-900/50 overflow-hidden shadow-sm"
                            >
                                <button
                                    onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                    className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                                >
                                    <span className="text-lg font-semibold text-gray-900 dark:text-white pr-8">
                                        {faq.question}
                                    </span>
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${openIndex === index ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-500'} transition-colors duration-300 flex-shrink-0`}>
                                        {openIndex === index ? (
                                            <Minus className="h-5 w-5" />
                                        ) : (
                                            <Plus className="h-5 w-5" />
                                        )}
                                    </div>
                                </button>
                                
                                <AnimatePresence>
                                    {openIndex === index && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: 'easeOut' }}
                                        >
                                            <div className="px-6 pb-6 text-base leading-relaxed text-gray-600 dark:text-gray-400 border-t border-gray-50 dark:border-white/5 pt-4">
                                                {faq.answer}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
