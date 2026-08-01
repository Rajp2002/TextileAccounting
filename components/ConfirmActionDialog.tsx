'use client'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

interface ConfirmActionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
    onConfirm: () => void | Promise<void>
    isDestructive?: boolean
    isLoading?: boolean
}

export function ConfirmActionDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    cancelLabel,
    onConfirm,
    isDestructive = false,
    isLoading = false,
}: ConfirmActionDialogProps) {
    const { t } = useTranslation()

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title || t('confirm.title')}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        {cancelLabel || t('confirm.cancel')}
                    </Button>
                    <Button
                        variant={isDestructive ? 'destructive' : 'default'}
                        onClick={onConfirm}
                        className="w-full sm:w-auto"
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {confirmLabel || t('confirm.proceed')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
