'use client'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHero, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertCircle, Loader2, TriangleAlert } from 'lucide-react'
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
    const Icon = isDestructive ? TriangleAlert : AlertCircle

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                tone={isDestructive ? 'danger' : 'brand'}
                watermark={Icon}
                showCloseButton={false}
                className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
            >
                <DialogHero icon={Icon}>
                    <DialogTitle className="text-2xl font-bold text-white">{title || t('confirm.title')}</DialogTitle>
                    <DialogDescription className="text-sm leading-[1.5] text-white/85">{description}</DialogDescription>
                </DialogHero>
                <DialogFooter className="relative z-10 flex-col-reverse gap-2 sm:flex-row sm:justify-stretch">
                    <Button
                        variant="ghost"
                        className="w-full sm:w-auto sm:flex-1 text-white hover:bg-white/10 hover:text-white"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                    >
                        {cancelLabel || t('confirm.cancel')}
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className="w-full bg-white font-semibold text-[#16213e] hover:bg-white/90 sm:w-auto sm:flex-1"
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
