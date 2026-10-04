import type { Metadata } from 'next'
import { requireFounderPage } from '@/lib/admin/founder'
import { FounderShell } from '@/components/admin/founder-shell'
import { SensitiveBoundary } from '@/components/admin/sensitive-boundary'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata: Metadata = { title: { default: 'Founder console — Weavly', template: '%s — Weavly founder' }, robots: { index: false, follow: false } }

export default async function FounderConsoleLayout({ children }: { children: React.ReactNode }) {
    const principal = await requireFounderPage()
    return <SensitiveBoundary userId={principal.userId} kind="founder"><FounderShell>{children}</FounderShell></SensitiveBoundary>
}
