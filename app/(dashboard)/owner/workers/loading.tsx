import { BaseRouteLoading } from '@/components/navigation/base-route-loading'

export default function Loading() {
  return (
    <BaseRouteLoading route="/owner/workers" title="Workers" centeredTitle>
      <div className="mx-auto w-full max-w-6xl space-y-6" aria-hidden="true">
        {/* Toolbar Skeleton */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-10 sm:h-11 flex-1 ui-skeleton rounded-xl bg-surface-soft" />
          <div className="flex gap-3">
            <div className="h-10 sm:h-11 w-32 ui-skeleton rounded-xl bg-surface-soft" />
            <div className="h-10 sm:h-11 w-36 ui-skeleton rounded-xl bg-surface-soft" />
          </div>
        </div>

        {/* 2 Workforce Groups (Piece Rate & Fixed Salary) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
          {[1, 2].map(group => (
            <div key={group} className="space-y-3.5">
              {/* Group Header */}
              <div className="flex items-center justify-between border-b border-hairline/60 pb-3">
                <div className="space-y-1">
                  <div className="h-5 w-28 ui-skeleton rounded-md bg-surface-soft" />
                  <div className="h-3.5 w-44 ui-skeleton rounded-md bg-surface-soft/70" />
                </div>
                <div className="h-5 w-16 ui-skeleton rounded-full bg-surface-soft" />
              </div>

              {/* Worker Cards Skeletons */}
              {[1, 2].map(card => (
                <div
                  key={card}
                  className="rounded-2xl border border-hairline bg-surface p-5 shadow-xs space-y-4"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 ui-skeleton rounded-xl bg-surface-soft" />
                      <div className="space-y-1.5">
                        <div className="h-4 w-32 ui-skeleton rounded-md bg-surface-soft" />
                        <div className="h-3 w-20 ui-skeleton rounded-md bg-surface-soft/70" />
                      </div>
                    </div>
                    <div className="h-5 w-16 ui-skeleton rounded-full bg-surface-soft" />
                  </div>

                  {/* 2-col config box */}
                  <div className="grid grid-cols-2 gap-3 rounded-xl border border-hairline/60 bg-surface-soft/30 p-3.5">
                    <div className="space-y-1">
                      <div className="h-3 w-16 ui-skeleton rounded bg-surface-soft" />
                      <div className="h-4 w-24 ui-skeleton rounded bg-surface-soft/80" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-3 w-16 ui-skeleton rounded bg-surface-soft" />
                      <div className="h-4 w-24 ui-skeleton rounded bg-surface-soft/80" />
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between border-t border-hairline/60 pt-4">
                    <div className="h-8 w-32 ui-skeleton rounded-xl bg-surface-soft" />
                    <div className="h-8 w-16 ui-skeleton rounded-xl bg-surface-soft" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </BaseRouteLoading>
  )
}
