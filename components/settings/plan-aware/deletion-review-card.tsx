'use client'

import React, { useState, useTransition, useId } from 'react'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { toast, userFacingError } from '@/lib/app-notifications'
import { useTranslation } from '@/lib/i18n/context'
import { globalQueryClient } from '@/lib/query-client-registry'
import { clearClientSessionState } from '@/lib/client-storage-cleanup'
import { deleteAccountPermanently } from '@/app/(dashboard)/owner/settings/account-deletion'
import { ACCOUNT_DELETION_CONFIRMATION_PHRASE } from '@/lib/account-deletion'

interface DeletionReviewCardProps {
    organizationName: string
    accountEmail: string
}

export function DeletionReviewCard({ organizationName, accountEmail }: DeletionReviewCardProps) {
    const { tx } = useTranslation()
    const [reviewOpen, setReviewOpen] = useState(false)
    const [enteredOrgName, setEnteredOrgName] = useState('')
    const [enteredPhrase, setEnteredPhrase] = useState('')
    const [pending, startTransition] = useTransition()

    const nameInputId = useId()
    const phraseInputId = useId()

    const canConfirm = (
        organizationName.trim().length > 0 &&
        enteredOrgName.trim() === organizationName.trim() &&
        enteredPhrase === ACCOUNT_DELETION_CONFIRMATION_PHRASE
    )

    const handleOpenChange = (open: boolean) => {
        if (pending) return
        setReviewOpen(open)
        if (!open) {
            setEnteredOrgName('')
            setEnteredPhrase('')
        }
    }

    const handleDelete = () => {
        if (!canConfirm || pending) return

        startTransition(async () => {
            try {
                const result = await deleteAccountPermanently({
                    organizationName: enteredOrgName,
                    confirmationPhrase: enteredPhrase,
                })

                if ('error' in result && result.error) {
                    toast.error(tx(userFacingError(result.error, 'Account deletion could not be completed.')))
                    return
                }

                if (globalQueryClient) globalQueryClient.clear()

                try {
                    await clearClientSessionState()
                } catch (err) {
                    console.warn('Unable to complete local session cleanup after account deletion', err)
                } finally {
                    window.location.assign('/login?account-deleted=1')
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Account deletion failed'
                toast.error(tx(msg))
            }
        })
    }

    return (
        <>
            {/* Small neutral card with restrained warning heading and Review deletion... button */}
            <section
                aria-labelledby="account-deletion-heading"
                className="rounded-2xl border border-hairline bg-[#FCFCFC] p-6 shadow-sm dark:bg-[#1A1A1A] sm:p-8"
            >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4 text-subtle" aria-hidden="true" />
                            <h2 id="account-deletion-heading" className="text-base font-semibold text-ink">
                                {tx('Account & factory deletion')}
                            </h2>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            {tx('Review the irreversible consequences of deleting this account and factory workspace.')}
                        </p>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setReviewOpen(true)}
                        className="min-h-11 shrink-0 border-hairline text-xs font-semibold hover:border-risk/40 hover:bg-risk/5 hover:text-risk"
                    >
                        {tx('Review deletion…')}
                    </Button>
                </div>
            </section>

            {/* Deletion Review Accessible Dialog */}
            <Dialog open={reviewOpen} onOpenChange={handleOpenChange}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-risk">
                            <AlertTriangle className="h-5 w-5 text-risk" aria-hidden="true" />
                            {tx('Permanently delete this account and factory?')}
                        </DialogTitle>
                        <DialogDescription className="space-y-3 pt-2 text-sm leading-relaxed text-ink/80">
                            <span>
                                {tx('This permanently deletes your personal Weavly login ({email}), the factory workspace ({factory}), and all stored factory records.', {
                                    email: accountEmail || 'your account',
                                    factory: organizationName || 'this factory',
                                })}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                                {tx('Active subscriptions are cancelled immediately. Payments already completed are not automatically refunded. Historical records are purged under tenant deletion policy.')}
                            </span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor={nameInputId} className="text-xs font-semibold text-ink">
                                {tx('Type the factory name to confirm:')}{' '}
                                <span className="font-bold text-ink">{organizationName}</span>
                            </Label>
                            <Input
                                id={nameInputId}
                                value={enteredOrgName}
                                onChange={e => setEnteredOrgName(e.target.value)}
                                autoComplete="off"
                                disabled={pending}
                                className="h-10 border-hairline text-sm"
                                placeholder={organizationName}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor={phraseInputId} className="text-xs font-semibold text-ink">
                                {tx('Type confirmation phrase:')}{' '}
                                <span className="font-mono font-bold text-risk">{ACCOUNT_DELETION_CONFIRMATION_PHRASE}</span>
                            </Label>
                            <Input
                                id={phraseInputId}
                                value={enteredPhrase}
                                onChange={e => setEnteredPhrase(e.target.value)}
                                autoComplete="off"
                                spellCheck={false}
                                disabled={pending}
                                className="h-10 border-hairline font-mono text-sm"
                                placeholder={ACCOUNT_DELETION_CONFIRMATION_PHRASE}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={pending}
                            className="min-h-11"
                        >
                            {tx('Cancel')}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={!canConfirm || pending}
                            className="min-h-11 gap-2 font-semibold"
                        >
                            {pending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    {tx('Deleting…')}
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    {tx('Delete everything permanently')}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
