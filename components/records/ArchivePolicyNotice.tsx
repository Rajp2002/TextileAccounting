'use client'

import { ArchiveRestore, Info, RotateCcw, ShieldCheck } from 'lucide-react'
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

export function ArchivePolicyNotice() {
  const { t } = useTranslation()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="estimator-touch-target group flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-indigo-200/80 bg-indigo-50/70 px-4 py-3 min-h-[50px] text-left text-sm font-semibold text-indigo-950 shadow-xs transition-all duration-150 hover:border-indigo-300 hover:bg-indigo-100/70 hover:shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.99]"
          aria-label={t('base_plan.archive.title')}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 transition-colors group-hover:bg-indigo-200">
              <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-bold text-indigo-950 whitespace-nowrap">{t('base_plan.archive.title')}</span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-100/80 px-2.5 py-1 text-xs font-medium text-indigo-700 transition-colors group-hover:bg-indigo-200/80">
            <Info className="h-3 w-3" aria-hidden="true" />
            <span>Policy</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 shadow-xs border border-indigo-200/60">
              <ArchiveRestore className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                {t('base_plan.archive.title')}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Data retention & restore principles
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div role="note" className="mt-2 space-y-3">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 transition-all">
            <div className="flex items-center gap-2 font-bold text-sm text-indigo-950">
              <RotateCcw className="h-4 w-4 text-indigo-600 shrink-0" />
              <span>Safe Archiving & Restore</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-indigo-900/90">
              {t('base_plan.archive.description')} {t('base_plan.archive.restore')}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 transition-all">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Privacy & Retention Controls</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              {t('base_plan.archive.deletion')} {t('base_plan.archive.privacy')}
            </p>
          </div>
        </div>

        <DialogFooter className="mt-2 border-t border-slate-100 pt-3">
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
