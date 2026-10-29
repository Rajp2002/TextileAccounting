import { Suspense, type ReactNode } from 'react'
import { PlanChooserHeader } from '@/components/plans/PlanChooserHeader'
import { BrandBackground } from '@/components/brand-background'

export default function PlanSelectionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="safe-area-page relative isolate flex min-h-svh flex-col bg-background font-sans text-ink">
      <BrandBackground variant="auth" className="opacity-40" />
      <div className="relative z-10 flex w-full flex-1 flex-col px-4 sm:px-[25px]">
        <Suspense fallback={<div className="h-16 border-b border-hairline/60" />}>
          <PlanChooserHeader />
        </Suspense>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
