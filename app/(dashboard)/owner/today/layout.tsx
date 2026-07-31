import AccessGate from '@/components/billing/AccessGate'

export default function FactoryTodayLayout({ children }: { children: React.ReactNode }) {
    return (
        <AccessGate
            requiredTier="premium"
            routeName="/owner/today"
        >
            {children}
        </AccessGate>
    )
}
