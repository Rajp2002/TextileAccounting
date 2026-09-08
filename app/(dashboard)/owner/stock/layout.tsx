import AccessGate from '@/components/billing/AccessGate'

export default function StockLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredCapability="production" routeName="/owner/stock">{children}</AccessGate>
}
