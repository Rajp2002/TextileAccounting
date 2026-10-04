import { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Link from 'next/link'
import { FormalCaseWorkspace, FormalIntake } from '../../../components/admin/formal-workspace'
import { RetentionReviewScreen } from '../../../components/admin/retention-review'
import { formalDetailSchema, type FormalDetail, type FormalKind } from '@/lib/admin/formal-contracts'
import { retentionFixture } from './fixture-data'
import '../../../app/globals.css'

function Fixture() {
    const path = window.location.pathname, kind: FormalKind = path.includes('/security/') || new URLSearchParams(window.location.search).get('kind') === 'security' ? 'security' : 'privacy'
    const [detail, setDetail] = useState<FormalDetail | null>(null)
    const refresh = useCallback(async () => {
        const response = await fetch(`/__formal_fixture__/detail?kind=${kind}`, { cache: 'no-store' })
        setDetail(formalDetailSchema.parse(await response.json()))
    }, [kind])
    useEffect(() => {
        if (!path.endsWith('/new') && !path.endsWith('/retention')) {
            let current = true
            fetch(`/__formal_fixture__/detail?kind=${kind}`, { cache: 'no-store' }).then(response => response.json()).then(value => { if (current) setDetail(formalDetailSchema.parse(value)) })
            return () => { current = false }
        }
    }, [path, kind])
    async function advance() {
        await fetch(`/__formal_fixture__/advance?kind=${kind}`, { method: 'POST' }); await refresh()
    }
    return <div className="min-h-screen bg-app-bg text-ink"><header className="border-b border-hairline bg-surface px-4 py-4 sm:px-8">
        <p className="text-sm font-semibold">Synthetic component fixtures — no authentication or production-data verification</p>
        <p className="mt-1 text-xs text-subtle">Actual formal-case and retention controls · isolated synthetic response adapter · no delivery, erasure or account changes</p>
        <nav className="mt-3 flex flex-wrap gap-5 text-sm" aria-label="Synthetic formal screens"><Link className="inline-flex min-h-11 items-center underline" href="/admin/formal/new">Manual intake</Link><Link className="inline-flex min-h-11 items-center underline" href="/admin/formal/privacy/20000000-0000-4000-8000-000000000001">Privacy case</Link><Link className="inline-flex min-h-11 items-center underline" href="/admin/formal/security/20000000-0000-4000-8000-000000000001">Security case</Link><Link className="inline-flex min-h-11 items-center underline" href="/admin/formal/retention">Retention review</Link></nav>
        {detail && <div className="mt-3 flex flex-wrap items-center gap-3"><p data-testid="synthetic-current-version" className="text-xs">Synthetic server version {detail.record.version}</p><button onClick={advance} className="min-h-11 rounded-lg border border-hairline px-3 text-xs">Refresh synthetic context to version 2</button></div>}
    </header><main className="mx-auto max-w-5xl px-4 py-6 sm:px-8">{path.endsWith('/new') ? <FormalIntake initialKind={kind}/> : path.endsWith('/retention') ? <RetentionReviewScreen report={retentionFixture()}/> : detail ? <FormalCaseWorkspace detail={detail} onSaved={refresh}/> : <p role="status">Loading synthetic case…</p>}</main></div>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
