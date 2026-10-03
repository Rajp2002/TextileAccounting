'use client'

import { TriangleAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHero, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
import { freeText } from '@/lib/i18n/free-tier'
import type { FreeLeaveReason } from '@/hooks/use-free-leave-guard'

/** Confirms a navigation that would clear page-memory work. Staying is the default. */
export function FreeLeaveDialog({ reason, open, onStay, onLeave }: { reason: FreeLeaveReason; open: boolean; onStay: () => void; onLeave: () => void }) {
  const { language } = useTranslation()
  const unresolved = reason === 'unresolved'
  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onStay() }}>
      <DialogContent tone="danger" watermark={TriangleAlert} showCloseButton={false} className="max-w-md">
        <DialogHero icon={TriangleAlert}>
          <DialogTitle className="text-2xl font-bold text-white">
            {freeText(language, unresolved ? 'leaveUnresolvedTitle' : 'leaveUnsavedTitle')}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-white/85">
            {freeText(language, unresolved ? 'leaveUnresolvedBody' : 'leaveUnsavedBody')}
          </DialogDescription>
        </DialogHero>
        <DialogFooter className="relative z-10 gap-2 sm:gap-2 sm:justify-stretch">
          <Button type="button" onClick={onStay} className="min-h-11 bg-white font-semibold text-[#7a2418] hover:bg-white/90 hover:text-[#7a2418] sm:flex-1">
            {freeText(language, 'stayOnPage')}
          </Button>
          <Button type="button" variant="ghost" onClick={onLeave} className="min-h-11 text-white hover:bg-white/10 hover:text-white sm:flex-1">
            {freeText(language, 'leaveAnyway')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
