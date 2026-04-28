'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Amount } from '@/components/ui/amount'
import { useTranslation } from '@/lib/i18n/context'
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog'

interface WorkerExitDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workerName: string
    amount: number
    onFinalSettle: () => void
    onWriteOff: () => void | Promise<void>
    onKeepActive: () => void
    isWriteOffLoading?: boolean
}

export function WorkerExitDialog({
    open,
    onOpenChange,
    workerName,
    amount,
    onFinalSettle,
    onWriteOff,
    onKeepActive,
    isWriteOffLoading = false,
}: WorkerExitDialogProps) {
    const { t } = useTranslation()
    const [showWriteOffConfirm, setShowWriteOffConfirm] = useState(false)
    const body = t('advances.exit.body')
        .replace('{name}', workerName)
        .replace('{amount}', new Intl.NumberFormat('en-IN').format(amount))
    const writeOffConfirm = t('advances.exit.writeOffConfirm')
        .replace('{amount}', new Intl.NumberFormat('en-IN').format(amount))

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-700">
                            <AlertTriangle className="h-5 w-5" />
                            {t('advances.exit.title')}
                        </DialogTitle>
                        <DialogDescription>{body}</DialogDescription>
                    </DialogHeader>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-amber-700">{workerName}</p>
                        <div className="mt-2 text-3xl font-black text-amber-900">
                            <Amount value={amount} />
                        </div>
                    </div>

                    <DialogFooter className="flex-col gap-2 sm:flex-col">
                        <Button className="w-full" onClick={onFinalSettle}>
                            {t('advances.exit.finalSettle')}
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => setShowWriteOffConfirm(true)}>
                            {t('advances.exit.writeOff')}
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => {
                                onKeepActive()
                                onOpenChange(false)
                            }}
                        >
                            {t('advances.exit.keepActive')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmActionDialog
                open={showWriteOffConfirm}
                onOpenChange={setShowWriteOffConfirm}
                title={t('advances.exit.writeOff')}
                description={writeOffConfirm}
                onConfirm={async () => {
                    await onWriteOff()
                    setShowWriteOffConfirm(false)
                }}
                isDestructive
                isLoading={isWriteOffLoading}
            />
        </>
    )
}
