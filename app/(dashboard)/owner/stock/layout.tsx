import AccessGate from '@/components/billing/AccessGate'
import StockPageTitle from './StockPageTitle'

export default function StockLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredCapability="production" routeName="/owner/stock"><StockPageTitle />{children}</AccessGate>
}
