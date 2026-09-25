'use client'

import { ArchiveRestore, ChevronRight, RotateCcw, ShieldCheck } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { railButton, railIcon } from '@/components/ui/rail'
import { cn } from '@/lib/utils'

export function ArchivePolicyNotice() {
  const { t } = useTranslation()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn('estimator-touch-target', railButton)}
          aria-label={t('base_plan.archive.title')}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <ArchiveRestore className={railIcon} aria-hidden="true" />
            <span className="min-w-0">{t('base_plan.archive.title')}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface-soft text-saffron-deep">
              <ArchiveRestore className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-ink">
                {t('base_plan.archive.title')}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                Data retention & restore principles
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div role="note" className="mt-2 space-y-3">
          <div className="rounded-xl border border-hairline bg-surface-soft/60 p-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <RotateCcw className="h-4 w-4 shrink-0 text-info" aria-hidden="true" />
              <span>Safe Archiving & Restore</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-body">
              {t('base_plan.archive.description')} {t('base_plan.archive.restore')}
            </p>
          </div>

          <div className="rounded-xl border border-hairline bg-surface-soft/60 p-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <span>Privacy & Retention Controls</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-body">
              {t('base_plan.archive.deletion')} {t('base_plan.archive.privacy')}
            </p>
          </div>
        </div>

        <DialogFooter className="mt-2 border-t border-hairline pt-3">
          <DialogClose asChild>
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
