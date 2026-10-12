import { BaseRouteLoading } from '@/components/navigation/base-route-loading'
import styles from '@/components/estimator/offer-check.module.css'
import { cn } from '@/lib/utils'

/** The page's own shape while it loads: the band of three inputs, then the navy panel's figure. */
export default function Loading() {
    return (
        <BaseRouteLoading route="/owner/quotes" title="Check an offer">
            <div className="relative overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
                <span aria-hidden="true" className={styles.selvedge} />
                <div className={cn(styles.band, 'grid grid-cols-2 gap-x-3 gap-y-5 border-b border-hairline p-4 pt-5 sm:gap-x-4 sm:p-6 sm:pt-7 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(0,0.9fr)] lg:px-8')}>
                    {['col-span-2 lg:col-span-1', '', ''].map((span, index) => (
                        <div key={index} className={cn('space-y-2', span)}>
                            <div className="ui-skeleton h-4 w-24 rounded bg-surface-soft" />
                            <div className="ui-skeleton h-[44px] rounded-lg border border-hairline bg-surface" />
                        </div>
                    ))}
                </div>
                <div className={cn(styles.loom, 'space-y-3 p-5 sm:p-6 lg:p-8')}>
                    <div className="ui-skeleton h-4 w-20 rounded bg-white/10" />
                    <div className="ui-skeleton h-11 w-44 rounded-lg bg-white/10" />
                    <div className="ui-skeleton h-4 w-72 max-w-full rounded bg-white/10" />
                </div>
            </div>
        </BaseRouteLoading>
    )
}
