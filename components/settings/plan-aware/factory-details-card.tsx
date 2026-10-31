'use client'

import React, { useState, useId } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, Factory, Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast, userFacingError } from '@/lib/app-notifications'
import { useSavedFlash } from '@/hooks/use-saved-flash'
import { useTranslation } from '@/lib/i18n/context'
import { updateFactoryDetails } from '@/app/(dashboard)/owner/settings/actions'
import { ReadOnlyValue, SettingsCardFooter, SettingsCardHeader, settingsCardBodyClassName, settingsCardClassName, settingsSaveButtonClassName } from './settings-card'

interface FactoryDetailsCardProps {
    initialFactoryName: string
    isAuthorizedEditor?: boolean
    /** The plan shown under the name, already in display form (Free, Lite, Base). */
    planName?: string
    planHref?: string
    onFactoryNameUpdated?: (newName: string) => void
    onDirtyChange?: (dirty: boolean) => void
}

export function FactoryDetailsCard({
    initialFactoryName,
    isAuthorizedEditor = true,
    planName,
    planHref,
    onFactoryNameUpdated,
    onDirtyChange,
}: FactoryDetailsCardProps) {
    const { t, tx } = useTranslation()
    const [justSaved, flashSaved] = useSavedFlash()
    const factoryInputId = useId()
    const factoryErrorId = useId()

    const [factoryName, setFactoryName] = useState(initialFactoryName)
    const [savedFactoryName, setSavedFactoryName] = useState(initialFactoryName)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [fieldError, setFieldError] = useState<string | null>(null)

    const isDirty = factoryName.trim() !== savedFactoryName.trim()

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setFactoryName(val)
        setFieldError(null)
        onDirtyChange?.(val.trim() !== savedFactoryName.trim())
    }

    const handleDiscard = () => {
        setFactoryName(savedFactoryName)
        setFieldError(null)
        onDirtyChange?.(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isAuthorizedEditor) return

        const trimmed = factoryName.trim()
        if (trimmed.length < 1) {
            setFieldError(tx('Factory name is required'))
            return
        }
        if (trimmed.length > 120) {
            setFieldError(tx('Factory name must be 120 characters or fewer'))
            return
        }

        setIsSubmitting(true)
        setFieldError(null)

        try {
            const result = await updateFactoryDetails({ name: trimmed })
            if ('error' in result && result.error) {
                setFieldError(tx(userFacingError(result.error, 'Failed to update factory details')))
                toast.error(tx(userFacingError(result.error, 'Failed to update factory details')))
            } else if (result.success) {
                setSavedFactoryName(result.name ?? trimmed)
                setFactoryName(result.name ?? trimmed)
                onFactoryNameUpdated?.(result.name ?? trimmed)
                onDirtyChange?.(false)
                toast.success(tx('Factory details saved'))
                flashSaved()
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to update factory details'
            setFieldError(tx(message))
            toast.error(tx(message))
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <section
            aria-labelledby="factory-details-heading"
            data-settings-card="true"
            className={settingsCardClassName}
        >
            <SettingsCardHeader
                icon={Factory}
                titleId="factory-details-heading"
                title={tx('Factory details')}
                description={tx('Identify your active factory workspace and review team connection details.')}
                scope="factory"
                className="border-b border-hairline"
            />

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
                <div className={`space-y-5 ${settingsCardBodyClassName}`}>
                    {/* Factory / Workspace Name */}
                    <div className="space-y-2">
                        <Label htmlFor={factoryInputId} className="text-sm font-semibold text-ink">
                            {tx('Factory name')} <span className="text-risk">*</span>
                        </Label>
                        {isAuthorizedEditor ? (
                            <>
                                <Input
                                    id={factoryInputId}
                                    type="text"
                                    value={factoryName}
                                    onChange={handleNameChange}
                                    maxLength={120}
                                    disabled={isSubmitting}
                                    aria-invalid={!!fieldError}
                                    aria-describedby={fieldError ? factoryErrorId : undefined}
                                    className="h-11 rounded-xl border-hairline bg-surface text-sm focus-visible:border-loom"
                                    placeholder={tx('Enter factory or business name')}
                                />
                                {fieldError && (
                                    <p id={factoryErrorId} className="text-xs font-medium text-risk" role="alert">
                                        {fieldError}
                                    </p>
                                )}
                            </>
                        ) : (
                            <ReadOnlyValue lockedLabel={tx('You can view this factory name, but only owners or admins can edit it.')}>
                                {factoryName || tx('Weavly')}
                            </ReadOnlyValue>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {isAuthorizedEditor
                                ? tx('Changes are used across your factory records and future documents.')
                                : tx('You can view this factory name, but only owners or admins can edit it.')}
                        </p>
                    </div>

                    {/* The plan this factory is on, with the way to change it. */}
                    {planName && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline/70 pt-4">
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-muted-foreground">{tx('Your plan')}</p>
                                <p className="mt-0.5 text-sm font-semibold text-ink">{planName}</p>
                            </div>
                            {planHref && (
                                <Link href={planHref} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-ink hover:text-saffron-deep">
                                    {tx('Manage plan')}
                                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                </Link>
                            )}
                        </div>
                    )}
                </div>

                {/* Form Actions */}
                {isAuthorizedEditor && (
                    <SettingsCardFooter dirty={isDirty}>
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
                                tx('Save factory details')
                            )}
                        </Button>
                    </SettingsCardFooter>
                )}
            </form>
        </section>
    )
}
