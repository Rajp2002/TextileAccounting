import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import styles from './customer-support.module.css'

/** Placeholder for the support page while the private session check runs; mirrors the real header, ticket list, guide and history panel. */
export function SupportSkeleton() {
  return <div role="status" aria-busy="true" aria-label="Loading support" className={styles.skeletonFrame}>
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div><Skeleton className="h-8 w-40" /><Skeleton className="mt-3 h-4 w-72 max-w-full" /></div>
        <Skeleton className="h-11 w-32 rounded-lg" />
      </header>
      <div className={styles.columns}>
        <div className={styles.primaryColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHeading}><Skeleton className="h-6 w-36" /><Skeleton className="h-10 w-24 rounded-lg" /></div>
            {[0, 1].map(row => <div key={row} className={styles.ticketRow}>
              <div className="grid gap-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-48" /></div>
              <Skeleton className="h-10 w-32 rounded-lg" />
            </div>)}
          </section>
        </div>
        <section className={cn(styles.panel, styles.guide)}>
          <Skeleton className="h-6 w-40" />
          <div className="mt-7 grid gap-7">{[0, 1, 2].map(row => <div key={row} className="flex gap-4"><Skeleton className="size-8 shrink-0 rounded-full" /><div className="grid flex-1 gap-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-full" /></div></div>)}</div>
        </section>
      </div>
    </div>
    <section className={cn(styles.panel, styles.export)}>
      <Skeleton className="size-12 shrink-0 rounded-full" />
      <div className="grid gap-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-64 max-w-full" /></div>
      <Skeleton className="ml-auto h-11 w-40 rounded-lg" />
    </section>
  </div>
}
