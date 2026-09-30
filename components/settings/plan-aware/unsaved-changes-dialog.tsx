'use client'

import React, { useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHero,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TriangleAlert } from 'lucide-react'
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
            <DialogContent tone="danger" watermark={TriangleAlert} showCloseButton={false} className="max-w-md">
                <DialogHero icon={TriangleAlert}>
                    <DialogTitle className="text-2xl font-bold text-white">
                        {tx('Discard unsaved changes?')}
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-relaxed text-white/85">
                        {tx('You have unsaved changes on this settings page. If you leave now, your changes will be discarded.')}
                    </DialogDescription>
                </DialogHero>

                <DialogFooter className="relative z-10 gap-2 sm:gap-2 sm:justify-stretch">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onKeepEditing}
                        className="min-h-11 text-white hover:bg-white/10 hover:text-white sm:flex-1"
                    >
                        {tx('Keep editing')}
                    </Button>
                    <Button
                        type="button"
                        onClick={onDiscard}
                        className="min-h-11 bg-white font-semibold text-[#7a2418] hover:bg-white/90 sm:flex-1"
                    >
                        {tx('Discard changes')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
