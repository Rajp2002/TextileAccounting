'use client'

import React from 'react'
import { Building2, User, Sparkles } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

interface Step1FactoryProps {
    factoryName: string
    ownerContact: string
    onChangeFactoryName: (name: string) => void
    onChangeOwnerContact: (contact: string) => void
    error?: string
}

export function Step1Factory({
    factoryName,
    ownerContact,
    onChangeFactoryName,
    onChangeOwnerContact,
    error,
}: Step1FactoryProps) {
    const { tx } = useTranslation()

    return (
        <div className="mx-auto max-w-xl space-y-6">
            <div className="space-y-2 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{tx('Step 1 of 6 · Factory Profile')}</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
                    {tx('Confirm your factory details')}
                </h2>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                    {tx('We’ve prefilled what we already know. This name will appear on cost estimates, production reports, and delivery challans.')}
                </p>
            </div>

            <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-6">
                {/* Factory Name */}
                <div className="space-y-1.5">
                    <label
                        htmlFor="factory-name-input"
                        className="flex items-center gap-2 text-sm font-semibold text-stone-800 dark:text-stone-200"
                    >
                        <Building2 className="h-4 w-4 text-amber-600" />
                        <span>{tx('Factory Name')}</span>
                        <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="factory-name-input"
                        type="text"
                        value={factoryName}
                        onChange={e => onChangeFactoryName(e.target.value)}
                        placeholder={tx('e.g. Surat Weaving Mills')}
                        className="h-11 w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 text-base text-stone-900 transition focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:focus:bg-stone-900"
                    />
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                        {tx('Used for customer quotes, quality cards, and worker registers.')}
                    </p>
                </div>

                {/* Owner / Primary Contact */}
                <div className="space-y-1.5 pt-2">
                    <label
                        htmlFor="owner-contact-input"
                        className="flex items-center gap-2 text-sm font-semibold text-stone-800 dark:text-stone-200"
                    >
                        <User className="h-4 w-4 text-amber-600" />
                        <span>{tx('Owner / Primary Contact')}</span>
                    </label>
                    <input
                        id="owner-contact-input"
                        type="text"
                        value={ownerContact}
                        onChange={e => onChangeOwnerContact(e.target.value)}
                        placeholder={tx('e.g. Ramesh Patel')}
                        className="h-11 w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 text-base text-stone-900 transition focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:focus:bg-stone-900"
                    />
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                        {tx('Your name or phone number for internal factory logs.')}
                    </p>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        {tx(error)}
                    </div>
                )}
            </div>
        </div>
    )
}
