'use client'

import React, { useState, useId } from 'react'
import { User, CheckCircle2, Loader2, Globe } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { LiquidSegmented } from '@/components/ui/liquid-segmented'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast, userFacingError } from '@/lib/app-notifications'
import { useSavedFlash } from '@/hooks/use-saved-flash'
import { useTranslation, type Language } from '@/lib/i18n/context'
import { updatePersonalInformation } from '@/app/(dashboard)/owner/settings/actions'
import { ReadOnlyValue, SettingsCardFooter, SettingsCardHeader, settingsCardBodyClassName, settingsCardClassName, settingsSaveButtonClassName } from './settings-card'

interface PersonalInformationCardProps {
    initialName: string
    email: string
    emailVerified?: boolean
    phone?: string | null
    onNameUpdated?: (newName: string) => void
    onDirtyChange?: (dirty: boolean) => void
}

const LANGUAGES: { code: Language; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'gu', label: 'ગુજરાતી' },
    { code: 'hi', label: 'हिंदी' },
]

export function PersonalInformationCard({
    initialName,
    email,
    emailVerified = false,
    phone,
    onNameUpdated,
    onDirtyChange,
}: PersonalInformationCardProps) {
    const { t, tx, language, setLanguage, languageStatus } = useTranslation()
    const [justSaved, flashSaved] = useSavedFlash()
    const nameInputId = useId()
    const nameErrorId = useId()

    const [name, setName] = useState(initialName)
    const [savedName, setSavedName] = useState(initialName)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [fieldError, setFieldError] = useState<string | null>(null)

    const isDirty = name.trim() !== savedName.trim()

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setName(val)
        setFieldError(null)
        onDirtyChange?.(val.trim() !== savedName.trim())
    }

    const handleDiscard = () => {
        setName(savedName)
        setFieldError(null)
        onDirtyChange?.(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const trimmed = name.trim()
        if (trimmed.length < 2) {
            setFieldError(tx('Name must be at least 2 characters long'))
            return
        }
        if (trimmed.length > 100) {
            setFieldError(tx('Name must be 100 characters or fewer'))
            return
        }

        setIsSubmitting(true)
        setFieldError(null)

        try {
            const result = await updatePersonalInformation({ fullName: trimmed })
            if ('error' in result && result.error) {
                setFieldError(tx(userFacingError(result.error, 'Failed to save personal information')))
                toast.error(tx(userFacingError(result.error, 'Failed to save personal information')))
            } else if (result.success) {
                setSavedName(result.fullName ?? trimmed)
                setName(result.fullName ?? trimmed)
                onNameUpdated?.(result.fullName ?? trimmed)
                onDirtyChange?.(false)
                toast.success(tx('Personal information saved'))
                flashSaved()
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to save personal information'
            setFieldError(tx(message))
            toast.error(tx(message))
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleLanguageChange = async (nextLang: Language) => {
        if (nextLang === language || languageStatus === 'loading') return
        const result = await setLanguage(nextLang)
        if (result.ok) {
            const langLabel = LANGUAGES.find(l => l.code === result.language)?.label ?? result.language
            toast.success(t('common.language_changed', { language: langLabel }))
        }
    }

    return (
        <section
            aria-labelledby="personal-info-heading"
            data-settings-card="true"
            className={settingsCardClassName}
        >
            <SettingsCardHeader
                icon={User}
                titleId="personal-info-heading"
                title={tx('Personal information')}
                description={tx('Manage your personal profile details and language preferences.')}
                scope="personal"
                className="border-b border-hairline"
            />

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
                <div className={`grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 ${settingsCardBodyClassName}`}>
                    {/* Your Name */}
                    <div className="space-y-2">
                        <Label htmlFor={nameInputId} className="text-sm font-semibold text-ink">
                            {tx('Your name')} <span className="text-risk">*</span>
                        </Label>
                        <Input
                            id={nameInputId}
                            type="text"
                            value={name}
                            onChange={handleNameChange}
                            maxLength={100}
                            disabled={isSubmitting}
                            aria-invalid={!!fieldError}
                            aria-describedby={fieldError ? nameErrorId : undefined}
                            className="h-11 rounded-xl border-hairline bg-surface text-sm focus-visible:border-loom"
                            placeholder={tx('Enter your full name')}
                            autoComplete="name"
                        />
                        {fieldError && (
                            <p id={nameErrorId} className="text-xs font-medium text-risk" role="alert">
                                {fieldError}
                            </p>
                        )}
                    </div>

                    {/* Preferred Language */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-ink flex items-center gap-1.5">
                            <Globe className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
                            {tx('Preferred language')}
                        </Label>
                        <LiquidSegmented
                            fullWidth
                            aria-label={tx('Preferred language')}
                            disabled={languageStatus === 'loading'}
                            value={language}
                            onValueChange={handleLanguageChange}
                            options={LANGUAGES.map(lang => ({ value: lang.code, label: lang.label }))}
                        />
                        <p className="text-xs text-muted-foreground">
                            {tx('Language changes apply immediately.')}
                        </p>
                    </div>

                    {/* Account Email (Read-only) */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <Label className="text-sm font-semibold text-ink">
                                {tx('Account email')}
                            </Label>
                            {emailVerified ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
                                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                    {tx('Verified')}
                                </span>
                            ) : (
                                <span className="rounded-full bg-surface-soft px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                    {tx('Unverified')}
                                </span>
                            )}
                        </div>
                        <ReadOnlyValue lockedLabel={tx('This cannot be changed here.')}>
                            {email || tx('Not provided')}
                        </ReadOnlyValue>
                    </div>

                    {/* Account Phone (Read-only) */}
                    <div className="space-y-2">
                        <div className="flex min-h-[22px] items-center">
                            <Label className="text-sm font-semibold text-ink">
                                {tx('Account phone')}
                            </Label>
                        </div>
                        <ReadOnlyValue lockedLabel={tx('This cannot be changed here.')}>
                            {phone || tx('Not provided')}
                        </ReadOnlyValue>
                    </div>
                </div>

                {/* Form Actions */}
                <SettingsCardFooter dirty={isDirty} note={tx('Email and phone are tied to your sign-in and cannot be changed here.')}>
                    {isDirty && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleDiscard}
                            disabled={isSubmitting}
                            className="min-h-11 rounded-xl px-4 font-medium"
                        >
                            {tx('Discard changes')}
                        </Button>
                    )}
                    <Button
                        type="submit"
                        disabled={!isDirty || isSubmitting}
                        className={settingsSaveButtonClassName(isDirty, justSaved)}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                {tx('Saving…')}
                            </>
                        ) : justSaved && !isDirty ? (
                            <>
                                <CheckCircle2 className="ui-success-pop h-4 w-4" aria-hidden="true" />
                                {t('base_plan.status.saved')}
                            </>
                        ) : (
                            tx('Save personal information')
                        )}
                    </Button>
                </SettingsCardFooter>
            </form>
        </section>
    )
}
