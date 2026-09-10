'use client'

import React, { useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'

interface UnsavedChangesDialogProps {
    open: boolean
    onKeepEditing: () => void
    onDiscard: () => void
}

export function useUnloadProtection(isDirty: boolean) {
    useEffect(() => {
        if (!isDirty) return

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ''
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [isDirty])
}

export function UnsavedChangesDialog({
    open,
    onKeepEditing,
    onDiscard,
}: UnsavedChangesDialogProps) {
    const { tx } = useTranslation()

    return (
        <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) onKeepEditing() }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-ink">
                        {tx('Discard unsaved changes?')}
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                        {tx('You have unsaved changes on this settings page. If you leave now, your changes will be discarded.')}
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onKeepEditing}
                        className="min-h-11"
                    >
                        {tx('Keep editing')}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={onDiscard}
                        className="min-h-11 font-semibold"
                    >
                        {tx('Discard changes')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
