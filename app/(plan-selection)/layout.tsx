import { Suspense, type ReactNode } from 'react'
import { PlanChooserHeader } from '@/components/plans/PlanChooserHeader'
import { BrandBackground } from '@/components/brand-background'

export default function PlanSelectionLayout({ children }: { children: ReactNode }) {
  return (
    // A desktop screen tall enough for the plan cards locks the page to the viewport: everything
    // fits on one screen and nothing scrolls. Shorter laptop screens keep scrolling so no button is cut off.
    <div className="safe-area-page relative isolate flex min-h-svh flex-col bg-background font-sans text-ink [@media(min-width:1024px)_and_(min-height:940px)]:h-svh [@media(min-width:1024px)_and_(min-height:940px)]:overflow-hidden">
      <BrandBackground variant="auth" className="opacity-40" />
      <div className="relative z-10 flex w-full flex-1 flex-col px-4 sm:px-[25px]">
        <Suspense fallback={<div className="h-16 border-b border-hairline/60" />}>
          <PlanChooserHeader />
        </Suspense>
        {/* Desktop leaves room at the bottom for the billing tiles peeking up from the edge. */}
        <main className="flex-1 lg:min-h-0 lg:pb-20">{children}</main>
      </div>
    </div>
  )
}
