import { Suspense, type ReactNode } from 'react'
import { PlanChooserHeader } from '@/components/plans/PlanChooserHeader'
import { BrandBackground } from '@/components/brand-background'

export default function PlanSelectionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="safe-area-page relative isolate flex h-svh min-h-0 flex-col overflow-hidden bg-background font-sans text-ink">
      <BrandBackground variant="auth" className="opacity-40" />
      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 sm:px-6 lg:px-8">
        <Suspense fallback={<div className="h-16 border-b border-hairline/60" />}>
          <PlanChooserHeader />
        </Suspense>
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  )
}
