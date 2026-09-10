import { Suspense, type ReactNode } from 'react'
import { PlanChooserHeader } from '@/components/plans/PlanChooserHeader'
import { BrandBackground } from '@/components/brand-background'

export default function PlanSelectionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-screen bg-background font-sans text-ink">
      <BrandBackground variant="auth" className="opacity-40" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
        <Suspense fallback={<div className="h-16 border-b border-hairline/60" />}>
          <PlanChooserHeader />
        </Suspense>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
