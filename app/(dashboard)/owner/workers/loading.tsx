import { BaseRouteLoading } from '@/components/navigation/base-route-loading'

export default function Loading() {
  return (
    <BaseRouteLoading route="/owner/workers" title="Workers">
      <div className="mx-auto w-full max-w-6xl space-y-6" aria-hidden="true">
        {/* Register Panel Skeleton */}
        <div className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 sm:px-6">
            <div className="h-4 w-36 animate-pulse rounded-md bg-surface-soft motion-reduce:animate-none" />
            <div className="h-3 w-16 animate-pulse rounded-md bg-surface-soft/70 motion-reduce:animate-none" />
          </div>

          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-y border-hairline/70 bg-surface-soft/25 p-4 sm:flex-row sm:items-center sm:px-6">
            <div className="h-10 sm:h-11 flex-1 animate-pulse rounded-xl bg-surface-soft motion-reduce:animate-none" />
            <div className="h-10 sm:h-11 w-full sm:w-32 animate-pulse rounded-xl bg-surface-soft motion-reduce:animate-none" />
            <div className="h-10 sm:h-11 w-full sm:w-36 animate-pulse rounded-xl bg-surface-soft motion-reduce:animate-none" />
          </div>

          {/* 3 Skeleton Rows */}
          <div className="divide-y divide-hairline">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-4"
              >
                {/* Left: Icon + Text */}
                <div className="flex flex-1 items-center gap-3">
                  <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-surface-soft motion-reduce:animate-none" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-32 animate-pulse rounded-md bg-surface-soft motion-reduce:animate-none" />
                    <div className="h-3 w-20 animate-pulse rounded-md bg-surface-soft/70 motion-reduce:animate-none" />
                  </div>
                </div>

                {/* Pay type */}
                <div className="hidden sm:block sm:w-28">
                  <div className="h-3.5 w-20 animate-pulse rounded-md bg-surface-soft motion-reduce:animate-none" />
                </div>

                {/* Middle: Badge */}
                <div className="hidden sm:block sm:w-20">
                  <div className="h-4 w-14 animate-pulse rounded-full bg-surface-soft motion-reduce:animate-none" />
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3 sm:justify-end">
                  <div className="h-4 w-28 animate-pulse rounded-md bg-surface-soft motion-reduce:animate-none" />
                  <div className="h-9 w-16 animate-pulse rounded-lg bg-surface-soft motion-reduce:animate-none" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BaseRouteLoading>
  )
}
