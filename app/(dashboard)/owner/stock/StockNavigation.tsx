'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { yarnStockText } from '@/lib/i18n/yarn-stock'

export default function StockNavigation() {
    const path = usePathname()
    const { language } = useTranslation()
    const text = yarnStockText[language]
    return <nav aria-label={text.title} className="mb-6 flex gap-2 border-b pb-3" data-i18n-skip="true">
        {[['/owner/stock', text.fabric], ['/owner/stock/yarn', text.yarn]].map(([href, label]) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined} className={`rounded-md px-4 py-2 text-sm font-medium ${path === href ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{label}</Link>)}
    </nav>
}
