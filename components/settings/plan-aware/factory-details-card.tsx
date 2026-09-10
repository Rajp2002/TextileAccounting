'use client'

import React, { useState, useId } from 'react'
import { Factory, Copy, Check, Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast, userFacingError } from '@/lib/app-notifications'
import { useTranslation } from '@/lib/i18n/context'
import { updateFactoryDetails } from '@/app/(dashboard)/owner/settings/actions'

interface FactoryDetailsCardProps {
    initialFactoryName: string
    joinCode?: string | null
    isAuthorizedEditor?: boolean
    onFactoryNameUpdated?: (newName: string) => void
    onDirtyChange?: (dirty: boolean) => void
}

export function FactoryDetailsCard({
    initialFactoryName,
    joinCode,
    isAuthorizedEditor = true,
    onFactoryNameUpdated,
    onDirtyChange,
}: FactoryDetailsCardProps) {
    const { tx } = useTranslation()
    const factoryInputId = useId()
    const factoryErrorId = useId()

    const [factoryName, setFactoryName] = useState(initialFactoryName)
    const [savedFactoryName, setSavedFactoryName] = useState(initialFactoryName)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [fieldError, setFieldError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

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
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to update factory details'
            setFieldError(tx(message))
            toast.error(tx(message))
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCopyJoinCode = async () => {
        if (!joinCode) return
        try {
            await navigator.clipboard.writeText(joinCode)
            setCopied(true)
            toast.success(tx('Join code copied!'))
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error(tx('Failed to copy join code'))
        }
    }

    return (
        <section
            aria-labelledby="factory-details-heading"
            className="rounded-2xl border border-hairline bg-[#FCFCFC] p-6 shadow-sm dark:bg-[#1A1A1A] sm:p-8"
        >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-hairline/80 pb-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Factory className="h-5 w-5 text-saffron" aria-hidden="true" />
                        <h2 id="factory-details-heading" className="text-lg font-bold tracking-tight text-ink">
                            {tx('Factory details')}
                        </h2>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        {tx('Identify your active factory workspace and review team connection details.')}
                    </p>
                </div>
                <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground">
                    {tx('Factory: Used for this factory.')}
                </Badge>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
                                    className="h-11 border-hairline bg-surface/90 text-sm focus-visible:border-saffron"
                                    placeholder={tx('Enter factory or business name')}
                                />
                                {fieldError && (
                                    <p id={factoryErrorId} className="text-xs font-medium text-risk" role="alert">
                                        {fieldError}
                                    </p>
                                )}
                            </>
                        ) : (
                            <div className="flex min-h-11 items-center rounded-lg border border-hairline bg-surface-soft/60 px-3.5 py-2 text-sm text-ink select-all">
                                {factoryName || tx('Weavly')}
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {isAuthorizedEditor
                                ? tx('Changes are used across your factory records and future documents.')
                                : tx('You can view this factory name, but only owners or admins can edit it.')}
                        </p>
                    </div>

                    {/* Join Code (if present) */}
                    {joinCode && (
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-ink">
                                {tx('Factory join code')}
                            </Label>
                            <div className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-hairline bg-surface-soft/60 px-3.5 py-1.5">
                                <span className="font-mono text-base font-bold tracking-widest text-ink select-all">
                                    {joinCode}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyJoinCode}
                                    className="min-h-9 gap-1.5 text-xs font-medium"
                                    aria-label={tx('Copy factory join code')}
                                >
                                    {copied ? (
                                        <>
                                            <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                                            {tx('Copied')}
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                            {tx('Copy')}
                                        </>
                                    )}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {tx('Supervisors use this code to connect their device to this factory.')}
                            </p>
                        </div>
                    )}
                </div>

                {/* Form Actions */}
                {isAuthorizedEditor && (
                    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-hairline/80 pt-4">
                        {isDirty && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleDiscard}
                                disabled={isSubmitting}
                                className="min-h-11 px-4"
                            >
                                {tx('Discard changes')}
                            </Button>
                        )}
                        <Button
                            type="submit"
                            variant="saffron"
                            disabled={!isDirty || isSubmitting}
                            className="min-h-11 px-5 font-semibold"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    {tx('Saving…')}
                                </>
                            ) : (
                                tx('Save factory details')
                            )}
                        </Button>
                    </div>
                )}
            </form>
        </section>
    )
}
