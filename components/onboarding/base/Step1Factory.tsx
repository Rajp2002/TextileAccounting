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
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] px-3 py-1 text-xs font-semibold text-[var(--wv-ochre-800)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{tx('Step 1 of 6 · Factory Profile')}</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-[var(--wv-neel-900)] sm:text-3xl">
                    {tx('Confirm your factory details')}
                </h2>
                <p className="text-sm text-[var(--wv-neel-700)]">
                    {tx('We’ve prefilled what we already know. This name will appear on cost estimates, production reports, and delivery challans.')}
                </p>
            </div>

            <div className="space-y-4 rounded-2xl border border-[var(--wv-cotton-400)] bg-white p-5 shadow-sm sm:p-6">
                {/* Factory Name */}
                <div className="space-y-1.5">
                    <label
                        htmlFor="factory-name-input"
                        className="flex items-center gap-2 text-sm font-semibold text-[var(--wv-neel-800)]"
                    >
                        <Building2 className="h-4 w-4 text-[var(--wv-brand-accent)]" />
                        <span>{tx('Factory Name')}</span>
                        <span className="text-[var(--wv-madder-600)]">*</span>
                    </label>
                    <input
                        id="factory-name-input"
                        type="text"
                        value={factoryName}
                        onChange={e => onChangeFactoryName(e.target.value)}
                        placeholder={tx('e.g. Surat Weaving Mills')}
                        className="h-11 w-full rounded-lg border border-[var(--wv-cotton-400)] bg-[var(--wv-cotton-100)]/50 px-3 text-base text-[var(--wv-neel-900)] transition focus:border-[var(--wv-brand-accent-strong)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--wv-brand-accent-strong)]"
                    />
                    <p className="text-xs text-[var(--wv-cotton-500)]">
                        {tx('Used for customer quotes, quality cards, and worker registers.')}
                    </p>
                </div>

                {/* Owner / Primary Contact */}
                <div className="space-y-1.5 pt-2">
                    <label
                        htmlFor="owner-contact-input"
                        className="flex items-center gap-2 text-sm font-semibold text-[var(--wv-neel-800)]"
                    >
                        <User className="h-4 w-4 text-[var(--wv-brand-accent)]" />
                        <span>{tx('Owner / Primary Contact')}</span>
                    </label>
                    <input
                        id="owner-contact-input"
                        type="text"
                        value={ownerContact}
                        onChange={e => onChangeOwnerContact(e.target.value)}
                        placeholder={tx('e.g. Ramesh Patel')}
                        className="h-11 w-full rounded-lg border border-[var(--wv-cotton-400)] bg-[var(--wv-cotton-100)]/50 px-3 text-base text-[var(--wv-neel-900)] transition focus:border-[var(--wv-brand-accent-strong)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--wv-brand-accent-strong)]"
                    />
                    <p className="text-xs text-[var(--wv-cotton-500)]">
                        {tx('Your name or phone number for internal factory logs.')}
                    </p>
                </div>

                {error && (
                    <div className="rounded-lg border border-[var(--wv-madder-200)] bg-[var(--wv-madder-50)] p-3 text-sm text-[var(--wv-madder-600)]">
                        {tx(error)}
                    </div>
                )}
            </div>
        </div>
    )
}
