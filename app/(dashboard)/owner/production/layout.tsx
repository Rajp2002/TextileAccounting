import AccessGate from '@/components/billing/AccessGate'

export default function BaseProductionLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredTier="base" routeName="/owner/production">{children}</AccessGate>
}
