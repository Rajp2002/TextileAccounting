import AccessGate from '@/components/billing/AccessGate'

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredTier="premium" routeName="/owner/inventory">{children}</AccessGate>
}
