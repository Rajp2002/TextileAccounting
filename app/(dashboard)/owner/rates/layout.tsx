import AccessGate from '@/components/billing/AccessGate'

export default function RatesLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredCapability="rate_book" routeName="/owner/rates">{children}</AccessGate>
}
