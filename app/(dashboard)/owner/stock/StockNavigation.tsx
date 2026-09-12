'use client'
import { usePathname } from 'next/navigation'
import { NavigationLink } from '@/components/navigation/navigation-link'
import { stockDestinations } from '@/lib/stock-navigation'
import { useTranslation } from '@/lib/i18n/context'

/** Retained for legacy flat navigation; Base uses the sidebar disclosure. */
export default function StockNavigation() {
    const pathname = usePathname()
    const { t } = useTranslation()
    return <nav aria-label={t('navigation.stock')} className="mb-6 flex gap-2 border-b pb-3">
        {stockDestinations.map(item => <NavigationLink key={item.id} href={item.href} aria-current={pathname === item.href ? 'page' : undefined}
            className={`rounded-md px-4 py-2 text-sm font-medium ${pathname === item.href ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
            {t(item.labelKey)}
        </NavigationLink>)}
    </nav>
}
