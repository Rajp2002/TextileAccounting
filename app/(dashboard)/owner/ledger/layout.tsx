import AccessGate from '@/components/billing/AccessGate'

export default function LedgerLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredTier="premium" routeName="/owner/ledger">{children}</AccessGate>
}
