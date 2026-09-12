import AccessGate from '@/components/billing/AccessGate'
import StockNavigation from './StockNavigation'

export default function StockLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredCapability="production" routeName="/owner/stock"><StockNavigation />{children}</AccessGate>
}
