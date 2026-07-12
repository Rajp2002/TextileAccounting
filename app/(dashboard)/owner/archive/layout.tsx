import AccessGate from '@/components/billing/AccessGate'

export default function ArchiveLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredTier="premium" routeName="/owner/archive">{children}</AccessGate>
}
