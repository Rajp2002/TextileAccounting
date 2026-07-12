import AccessGate from '@/components/billing/AccessGate'

export default function SystemHealthLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredTier="premium" routeName="/owner/system-health">{children}</AccessGate>
}
