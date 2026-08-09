'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast, userFacingError } from '@/lib/app-notifications'
import { useTranslation } from '@/lib/i18n/context'
import { globalQueryClient } from '@/lib/query-client-registry'
import { clearClientSessionState } from '@/lib/client-storage-cleanup'
import { deleteAccountPermanently } from '@/app/(dashboard)/owner/settings/account-deletion'
import { ACCOUNT_DELETION_CONFIRMATION_PHRASE } from '@/lib/account-deletion'

export function DeleteAccountCard({ organizationName }: { organizationName: string }) {
    const { tx } = useTranslation()
    const [open, setOpen] = useState(false)
    const [enteredName, setEnteredName] = useState('')
    const [enteredPhrase, setEnteredPhrase] = useState('')
    const [pending, startTransition] = useTransition()

    const canConfirm = organizationName.trim().length > 0
        && enteredName.trim() === organizationName.trim()
        && enteredPhrase === ACCOUNT_DELETION_CONFIRMATION_PHRASE

    function resetForm() {
        setEnteredName('')
        setEnteredPhrase('')
    }

    function handleOpenChange(nextOpen: boolean) {
        if (pending) return
        setOpen(nextOpen)
        if (!nextOpen) resetForm()
    }

    function handleDelete() {
        if (!canConfirm || pending) return

        startTransition(async () => {
            const result = await deleteAccountPermanently({
                organizationName: enteredName,
                confirmationPhrase: enteredPhrase,
            })

            if ('error' in result) {
                toast.error(tx(userFacingError(result.error, 'Account deletion could not be completed.')))
                return
            }

            if (globalQueryClient) globalQueryClient.clear()

            try {
                await clearClientSessionState()
            } catch (error) {
                console.warn('Unable to complete local cleanup after account deletion', error)
            } finally {
                window.location.assign('/login?account-deleted=1')
            }
        })
    }

    return (
        <>
            <div className="rounded-lg border border-risk/30 bg-risk/5 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-risk/30 bg-risk/10 text-risk">
                        <Trash2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold leading-tight text-ink">Delete account permanently</h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            Permanently delete this login, the organization, all factory records, billing history, audit history, and connected team accounts.
                        </p>
                    </div>
                </div>

                <div className="mt-4 rounded-lg border border-risk/20 bg-surface/70 p-3 text-sm leading-relaxed text-risk">
                    This cannot be undone. The same email can be used again only after this account and its organization are fully deleted.
                </div>

                <Button
                    type="button"
                    variant="destructive"
                    className="mt-5"
                    onClick={() => setOpen(true)}
                    disabled={!organizationName}
                >
                    <Trash2 className="h-4 w-4" />
                    Delete account permanently
                </Button>
            </div>

            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-risk">
                            <AlertTriangle className="h-5 w-5" />
                            Permanently delete this account?
                        </DialogTitle>
                        <DialogDescription>
                            <div className="space-y-3">
                                <p>
                                    This permanently removes your Weavly login, this organization, every factory record, billing and audit history, and all connected supervisor accounts.
                                </p>
                                <p>
                                    Any active subscription is cancelled first. Payments already made are not automatically refunded. The deletion cannot be reversed.
                                </p>
                            </div>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="delete-account-organization-name">
                                Type the organization name: <span className="font-semibold">{organizationName}</span>
                            </Label>
                            <Input
                                id="delete-account-organization-name"
                                value={enteredName}
                                onChange={(event) => setEnteredName(event.target.value)}
                                autoComplete="off"
                                disabled={pending}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="delete-account-confirmation-phrase">
                                Type <span className="font-mono font-bold">{ACCOUNT_DELETION_CONFIRMATION_PHRASE}</span> to confirm
                            </Label>
                            <Input
                                id="delete-account-confirmation-phrase"
                                value={enteredPhrase}
                                onChange={(event) => setEnteredPhrase(event.target.value)}
                                autoComplete="off"
                                spellCheck={false}
                                disabled={pending}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={pending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={!canConfirm || pending}
                        >
                            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            {pending ? 'Deleting account…' : 'Delete everything permanently'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
