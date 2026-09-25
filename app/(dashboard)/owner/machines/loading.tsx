import { BaseRouteLoading } from '@/components/navigation/base-route-loading'

export default function Loading() {
  return (
    <BaseRouteLoading route="/owner/machines" title="Machines" centeredTitle>
      <div className="mx-auto w-full max-w-6xl space-y-6" aria-hidden="true">
        {/* Toolbar Skeleton */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-10 sm:h-11 flex-1 animate-pulse rounded-xl bg-surface-soft motion-reduce:animate-none" />
          <div className="h-10 sm:h-11 w-full sm:w-40 animate-pulse rounded-xl bg-surface-soft motion-reduce:animate-none" />
        </div>

        {/* 4 Machine Card Skeletons in 2-column Grid */}
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="flex flex-col justify-between rounded-2xl border border-hairline bg-surface p-5 shadow-xs"
            >
              <div className="space-y-4">
                {/* Header: Icon + Name + Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-surface-soft motion-reduce:animate-none" />
                    <div className="space-y-1.5">
                      <div className="h-5 w-32 animate-pulse rounded-md bg-surface-soft motion-reduce:animate-none" />
                      <div className="h-3.5 w-20 animate-pulse rounded-md bg-surface-soft/70 motion-reduce:animate-none" />
                    </div>
                  </div>
                  <div className="h-5 w-18 animate-pulse rounded-full bg-surface-soft motion-reduce:animate-none" />
                </div>

                {/* Configuration Details Box */}
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-hairline/60 bg-surface-soft/30 p-3.5">
                  <div className="space-y-1.5">
                    <div className="h-3 w-14 animate-pulse rounded bg-surface-soft/70 motion-reduce:animate-none" />
                    <div className="h-4 w-24 animate-pulse rounded bg-surface-soft motion-reduce:animate-none" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3 w-14 animate-pulse rounded bg-surface-soft/70 motion-reduce:animate-none" />
                    <div className="h-4 w-24 animate-pulse rounded bg-surface-soft motion-reduce:animate-none" />
                  </div>
                </div>
              </div>

              {/* Actions Skeleton */}
              <div className="mt-5 flex items-center justify-between border-t border-hairline/60 pt-4">
                <div className="h-9 w-32 animate-pulse rounded-xl bg-surface-soft motion-reduce:animate-none" />
                <div className="h-9 w-16 animate-pulse rounded-xl bg-surface-soft motion-reduce:animate-none" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </BaseRouteLoading>
  )
}
