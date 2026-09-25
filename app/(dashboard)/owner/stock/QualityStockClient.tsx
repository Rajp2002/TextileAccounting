'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RefreshCw, Warehouse } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useTranslation } from '@/lib/i18n/context'
import { StockAdjustmentSchema, type QualityStockBoard, type StockAdjustmentInput, type StockQuality } from '@/lib/quality-stock'
import { getQualityStockBoard, recordQualityStockAdjustment } from './actions'

export default function QualityStockClient({ initialData }: { initialData: QualityStockBoard }) {
    const { t, language } = useTranslation()
    const router = useRouter()
    const [data, setData] = useState(initialData)
    const [search, setSearch] = useState('')
    const [qualityId, setQualityId] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [form, setForm] = useState<{ kind: 'opening' | 'correction'; quality?: StockQuality } | null>(null)
    const [label, setLabel] = useState('')
    const [meters, setMeters] = useState('')
    const [reason, setReason] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState('')
    const [request, setRequest] = useState<StockAdjustmentInput | null>(null)
    const loading = useRef(false)
    const writing = useRef(false)
    const tx = (key: string) => t(`qualityStock.${key}`)
    const metres = (value: number) => Number(value).toLocaleString(language === 'en' ? 'en-IN' : `${language}-IN`, { maximumFractionDigits: 2 })

    useEffect(() => { setData(initialData); setQualityId('') }, [initialData])
    // A tab returning from Production should show current stock. Explicit refresh
    // also works when the browser cannot deliver a focus event.
    useEffect(() => {
        const refresh = () => { if (!document.hidden) router.refresh() }
        document.addEventListener('visibilitychange', refresh)
        window.addEventListener('focus', refresh)
        return () => { document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh) }
    }, [router])

    async function load(filter = qualityId, more = false) {
        if (loading.current) return
        loading.current = true; setBusy(true); setError('')
        try {
            const result = await getQualityStockBoard({ qualityId: filter || undefined, cursor: more ? data.nextCursor ?? undefined : undefined })
            if ('error' in result) { setError(tx('loadError')); return }
            setQualityId(filter)
            setData(previous => ({ ...result.data, movements: more ? [...previous.movements, ...result.data.movements.filter(row => !previous.movements.some(old => old.id === row.id))] : result.data.movements }))
        } catch { setError(tx('loadError')) }
        finally { loading.current = false; setBusy(false) }
    }
    function open(kind: 'opening' | 'correction', quality?: StockQuality) {
        setForm({ kind, quality }); setLabel(quality?.quality_label ?? ''); setMeters(kind === 'correction' ? String(quality?.meters ?? '') : '')
        setReason(''); setSaveError(''); setRequest(null)
    }
    async function save() {
        if (!form || writing.current) return
        const input = request ?? { qualityLabel: label, meters: meters.trim() ? Number(meters) : NaN, kind: form.kind, reason, clientRequestId: crypto.randomUUID(), expectedMeters: form.kind === 'correction' ? Number(form.quality?.meters) : undefined }
        if (!StockAdjustmentSchema.safeParse(input).success) { setSaveError(tx('validation')); return }
        // Keep the exact reviewed request after a network failure, including its UUID.
        // The user can safely retry; editing uncertain requests is deliberately disabled.
        setRequest(input); writing.current = true; setSaving(true); setSaveError('')
        try {
            const result = await recordQualityStockAdjustment(input)
            if ('error' in result) { setSaveError(tx(result.errorKey)); return }
            setForm(null); setRequest(null); setNotice(tx('saved')); await load()
        } catch { setSaveError(tx('retrySame')) }
        finally { writing.current = false; setSaving(false) }
    }
    const qualities = data.qualities.filter(row => row.quality_label.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    return <div className="space-y-6" data-i18n-skip="true">
        <header className="grid gap-4 border-b border-hairline/80 pb-5 text-center sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:pb-6">
            <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:col-start-2 sm:row-start-1 sm:text-[2rem]">{tx('title')}</h1>
            <div className="flex flex-wrap justify-center gap-2 sm:col-start-3 sm:row-start-1 sm:justify-self-end">
                <Button asChild variant="outline" className="border-loom/30 text-loom hover:bg-loom/5 gap-1.5 font-medium">
                    <Link href="/owner/stock/audit">
                        <Warehouse className="h-4 w-4" />
                        Audit Inventory
                    </Link>
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => void load()}><RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />{tx('refresh')}</Button><Button onClick={() => open('opening')}>{tx('opening')}</Button>
            </div>
        </header>
        {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-800">{error} <button className="underline" onClick={() => void load()}>{tx('retry')}</button></p>}
        <Card><CardContent className="flex items-center gap-4 p-6"><Warehouse className="h-8 w-8 text-orange-600" /><div><p className="text-sm text-muted-foreground">{tx('available')}</p><p className="text-3xl font-semibold tabular-nums">{metres(data.total_meters)} {tx('metres')}</p><p className="text-sm text-muted-foreground">{data.qualities.length} {tx('qualities')}</p></div></CardContent></Card>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p>{tx('cutover')}</p>{Number(data.cutover?.legacy_lot_count) > 0 && <p className="mt-2 font-medium">{tx('legacyCommitted')}</p>}
            {data.cutover && <p className="mt-2">{tx('started')} {new Date(data.cutover.started_at).toLocaleString(`${language}-IN`, { timeZone: 'Asia/Kolkata' })}. {tx('historical')}: {metres(data.cutover.historical_production_meters)} {tx('metres')}.</p>}
            {Number(data.cutover?.unallocated_production_meters) > 0 && <p className="mt-2">{tx('unallocated')}: {metres(data.cutover!.unallocated_production_meters)} {tx('metres')}.</p>}
            <p className="mt-2">{tx('correctionNote')}</p>
        </div>
        <section className="space-y-3" aria-labelledby="stock-qualities">
            <h2 id="stock-qualities" className="text-xl font-semibold">{tx('byQuality')}</h2>
            <Label htmlFor="stock-search" className="sr-only">{tx('search')}</Label><Input id="stock-search" placeholder={tx('search')} value={search} onChange={event => setSearch(event.target.value)} />
            {qualities.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center"><p>{search ? tx('noMatches') : tx('empty')}</p><Button asChild variant="link"><Link href="/owner/production">{tx('production')}</Link></Button></div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{qualities.map(quality => <Card key={quality.id}><CardContent className="space-y-4 p-5">
                <h3 className="break-words font-semibold">{quality.quality_label}</h3><p className="text-2xl font-semibold tabular-nums">{metres(quality.meters)} <span className="text-sm font-normal">{tx('metres')}</span></p>
                {!quality.opening_recorded && <p className="text-xs text-amber-700">{tx('openingPending')}</p>}
                <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => open(quality.opening_recorded ? 'correction' : 'opening', quality)}>{quality.opening_recorded ? tx('correct') : tx('opening')}</Button>{!quality.opening_recorded && <Button variant="outline" size="sm" onClick={() => open('correction', quality)}>{tx('correct')}</Button>}<Button variant="ghost" size="sm" disabled={busy} onClick={() => void load(quality.id)}>{tx('history')}</Button></div>
            </CardContent></Card>)}</div>}
        </section>
        <section className="space-y-3" aria-labelledby="stock-history" aria-busy={busy}>
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="stock-history" className="text-xl font-semibold">{tx('history')}</h2><Label htmlFor="history-quality" className="sr-only">{tx('quality')}</Label><select id="history-quality" className="max-w-full rounded-md border bg-background p-2 text-sm" value={qualityId} disabled={busy} onChange={event => void load(event.target.value)}><option value="">{tx('allQualities')}</option>{data.qualities.map(row => <option value={row.id} key={row.id}>{row.quality_label}</option>)}</select></div>
            {data.movements.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-muted-foreground">{tx('noHistory')}</p> : <ol className="divide-y rounded-xl border">{data.movements.map(row => <li key={row.id} className="flex flex-wrap justify-between gap-3 p-4"><div className="min-w-0 space-y-1"><p className="break-words font-medium">{row.quality_label} · {tx(row.kind === 'production' ? 'productionEntry' : row.kind)}</p><p className="max-w-xl break-words text-sm">{row.reason === 'Production updated' ? tx('productionUpdated') : row.reason}</p><p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString(`${language}-IN`, { timeZone: 'Asia/Kolkata' })}</p>{row.kind === 'production' && <Link href="/owner/production" className="text-xs text-orange-700 underline">{tx('production')}</Link>}</div><div className="text-right tabular-nums"><p className={Number(row.meters_delta) < 0 ? 'font-semibold text-rose-700' : 'font-semibold text-emerald-700'}>{Number(row.meters_delta) > 0 ? '+' : ''}{metres(row.meters_delta)} {tx('metres')}</p><p className="text-xs text-muted-foreground">{tx('balanceAfter')}: {metres(row.balance_after)} {tx('metres')}</p></div></li>)}</ol>}
            {data.nextCursor && <Button variant="outline" disabled={busy} onClick={() => void load(qualityId, true)}>{busy ? tx('loading') : tx('more')}</Button>}
        </section>
        <Dialog open={Boolean(form)} onOpenChange={value => { if (!value && !saving) setForm(null) }}><DialogContent data-i18n-skip="true" showCloseButton={false}><DialogHeader><DialogTitle>{form?.kind === 'opening' ? tx('opening') : tx('correct')}</DialogTitle><DialogDescription>{form?.kind === 'opening' ? tx('openingHelp') : tx('correctHelp')}</DialogDescription></DialogHeader>
            <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save() }}>
                <div className="space-y-2"><Label htmlFor="stock-quality">{tx('quality')}</Label><Input id="stock-quality" list="stock-known-qualities" value={label} disabled={Boolean(form?.quality) || Boolean(request)} onChange={event => setLabel(event.target.value)} maxLength={160} required /><datalist id="stock-known-qualities">{data.qualities.map(row => <option key={row.id} value={row.quality_label} />)}</datalist></div>
                <div className="space-y-2"><Label htmlFor="stock-metres">{form?.kind === 'opening' ? tx('openingMetres') : tx('countedMetres')}</Label><Input id="stock-metres" type="number" inputMode="decimal" min="0" max="100000000" step="0.01" value={meters} disabled={Boolean(request)} onChange={event => setMeters(event.target.value)} required />{form?.quality && <p className="text-xs text-muted-foreground">{tx('current')}: {metres(form.quality.meters)} {tx('metres')}</p>}</div>
                <div className="space-y-2"><Label htmlFor="stock-reason">{tx('reason')}</Label><textarea id="stock-reason" className="min-h-20 w-full rounded-md border bg-background p-3 text-sm" value={reason} disabled={Boolean(request)} onChange={event => setReason(event.target.value)} minLength={3} maxLength={500} required /></div>
                {saveError && <p role="alert" className="text-sm text-rose-700">{saveError}</p>}
                {request && !saving && <p className="text-xs text-muted-foreground">{tx('retrySame')}</p>}
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => { setForm(null); void load() }}>{tx('close')}</Button><Button type="submit" disabled={saving}>{saving ? tx('saving') : request ? tx('retry') : tx('save')}</Button></div>
            </form>
        </DialogContent></Dialog>
    </div>
}
