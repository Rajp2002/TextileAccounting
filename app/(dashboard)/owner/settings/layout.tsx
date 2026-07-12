import AccessGate from '@/components/billing/AccessGate'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredTier="base">{children}</AccessGate>
}
