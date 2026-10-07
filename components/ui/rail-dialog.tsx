'use client'

import type { ElementType, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { railButton, railIcon } from '@/components/ui/rail'
import { cn } from '@/lib/utils'

/**
 * A rail pill that opens its guidance in a modal, the same pill-to-modal pattern as
 * `ArchivePolicyNotice`. Help and principles use it so the reading happens in focus instead of
 * inside a cramped inline disclosure.
 *
 * `lang` and `i18nSkip` are for guidance that is already written in the active language: the
 * dialog renders in a portal, outside any wrapper that could carry them, so they go on the
 * trigger and the dialog content themselves.
 */
export function RailDialog({ icon: Icon, title, lang, i18nSkip, children }: {
    icon: ElementType
    title: string
    lang?: string
    i18nSkip?: boolean
    children: ReactNode
}) {
    const skip = i18nSkip ? 'true' : undefined
    return (
        <Dialog>
            <DialogTrigger asChild>
                <button type="button" data-i18n-skip={skip} lang={lang} className={cn('estimator-touch-target', railButton)}>
                    <span className="flex min-w-0 items-center gap-2.5">
                        <Icon className={railIcon} aria-hidden="true" />
                        <span className="min-w-0">{title}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
            </DialogTrigger>
            {/* No description: the title names the dialog and the body is the content itself. */}
            <DialogContent data-i18n-skip={skip} lang={lang} aria-describedby={undefined} className="sm:max-w-lg">
                <DialogHeader className="pr-9">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface-soft text-saffron-deep">
                            <Icon className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <DialogTitle className="min-w-0 text-lg font-bold">{title}</DialogTitle>
                    </div>
                </DialogHeader>
                <div className="space-y-3">{children}</div>
            </DialogContent>
        </Dialog>
    )
}

/** One titled block of guidance inside a `RailDialog`. */
export function RailDialogSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-hairline bg-surface-soft/60 p-3.5">
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-body">{children}</p>
        </section>
    )
}
