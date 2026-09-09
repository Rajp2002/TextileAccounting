import AccessGate from '@/components/billing/AccessGate'
export default function LegacyDispatchLayout({children}:{children:React.ReactNode}) {return <AccessGate requiredCapability="legacy_full_suite" routeName="/owner/dispatches/legacy">{children}</AccessGate>}
