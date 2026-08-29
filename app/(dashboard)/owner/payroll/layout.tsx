import AccessGate from '@/components/billing/AccessGate'
import QueryProvider from '@/components/query-provider'

export default function PremiumLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredCapability="production" routeName="/owner/payroll"><QueryProvider>{children}</QueryProvider></AccessGate>
}
