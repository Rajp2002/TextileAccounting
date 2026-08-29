import AccessGate from '@/components/billing/AccessGate'

export default function QuotesLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredCapability="saved_costings" routeName="/owner/quotes">{children}</AccessGate>
}
