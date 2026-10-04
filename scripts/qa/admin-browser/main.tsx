import { useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import FactoriesPage from '../../../app/(admin-console)/admin/factories/page'
import FactoryDetailPage from '../../../app/(admin-console)/admin/factories/[orgId]/page'
import TodayPage from '../../../app/(admin-console)/admin/page'
import PaymentsPage from '../../../app/(admin-console)/admin/payments/page'
import SystemPage from '../../../app/(admin-console)/admin/system/page'
import AuditPage from '../../../app/(admin-console)/admin/audit/page'
import { LegacyList, LegacyLimits, LegacyRecordDetail } from '../../../components/admin/legacy-records'
import { legacyFixtureList, legacyFixtureRecord } from './legacy-fixtures'
import '../../../app/globals.css'

async function page() {
    const path = window.location.pathname
    const searchParams = Promise.resolve(Object.fromEntries(new URLSearchParams(window.location.search)))
    if (path === '/admin/factories') return FactoriesPage({ searchParams })
    if (path.startsWith('/admin/factories/')) return FactoryDetailPage({ params: Promise.resolve({ orgId: path.split('/').at(-1)! }) })
    if (path === '/admin') return TodayPage()
    if (path === '/admin/payments') return PaymentsPage({ searchParams })
    if (path === '/admin/system') return SystemPage()
    if (path === '/admin/audit') return AuditPage({ searchParams })
    if (path === '/admin/legacy') return <><h1 className="mb-5 text-2xl font-semibold">Formal operations</h1><LegacyList report={legacyFixtureList()}/><LegacyLimits/></>
    if (path.startsWith('/admin/legacy/')) return <><h1 className="mb-5 text-2xl font-semibold">Synthetic privacy request</h1><LegacyRecordDetail record={legacyFixtureRecord()}/><LegacyLimits/></>
    return <p>This route is outside the synthetic read-screen fixture. Support is tested in its separate component harness.</p>
}
function Fixture() {
    const [content, setContent] = useState<ReactNode>(<p role="status">Loading synthetic screen…</p>)
    useEffect(() => { let current = true; page().then(result => { if (current) setContent(result) }).catch(() => { if (current) setContent(<p>Synthetic fixture could not render.</p>) }); return () => { current = false } }, [])
    return <div className="min-h-screen bg-app-bg text-ink"><header className="border-b border-hairline bg-surface px-4 py-4 sm:px-8"><p className="text-sm font-semibold">Synthetic component fixtures — no authentication or production-data verification</p><p className="mt-1 text-xs text-subtle">Actual Weavly page and control components · isolated loopback DTOs · no account or business writes</p><nav aria-label="Synthetic screen navigation" className="mt-3 flex flex-wrap gap-5 text-sm">{[['/admin', 'Today'], ['/admin/factories', 'Factories'], ['/admin/payments', 'Payments'], ['/admin/system', 'System'], ['/admin/audit', 'Audit']].map(([href, label]) => <a key={href} href={href} className="inline-flex min-h-11 items-center underline underline-offset-4">{label}</a>)}</nav></header><main className="mx-auto max-w-7xl px-4 py-6 sm:px-8">{content}</main></div>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
