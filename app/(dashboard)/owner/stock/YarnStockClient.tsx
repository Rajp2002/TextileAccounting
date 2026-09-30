'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useTranslation } from '@/lib/i18n/context'
import { yarnStockText } from '@/lib/i18n/yarn-stock'
import { YarnMutationSchema, totalYarnKg, yarnAuditCsv, yarnMovementUsage, type YarnBalance, type YarnBoard, type YarnMutation, type YarnQuality } from '@/lib/yarn-stock'
import { getYarnStockBoard, mutateYarnStock } from './yarn-actions'

type Entry = { kind: 'opening' | 'receipt' | 'correction'; yarn?: YarnBalance } | { kind: 'recipe'; quality: YarnQuality }

export default function YarnStockClient({ initialData }: { initialData: YarnBoard }) {
    const { language, t } = useTranslation(), text = yarnStockText[language]
    const [data, setData] = useState(initialData)
    const [date, setDate] = useState(''), [filter, setFilter] = useState('')
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(false)
    const [entry, setEntry] = useState<Entry | null>(null)
    const [name, setName] = useState(''), [weight, setWeight] = useState(''), [reason, setReason] = useState(''), [costing, setCosting] = useState('')
    const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(''), [request, setRequest] = useState<YarnMutation | null>(null)
    const loading = useRef(false), writing = useRef(false)
    const storageKey = `weavly-yarn-stock-request:${initialData.org_id}`
    const kg = (n: number) => Number(n).toLocaleString(`${language}-IN`, { maximumFractionDigits: 9 })
    const dateTime = (value: string) => new Date(value).toLocaleString(`${language}-IN`, { timeZone: 'Asia/Kolkata' })

    // Scope recovery to the tenant. A retry retains the original immutable payload.
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(storageKey)
            if (!raw) return
            const parsed = YarnMutationSchema.safeParse(JSON.parse(raw))
            if (!parsed.success) { sessionStorage.removeItem(storageKey); return }
            const pending = parsed.data
            // Recover external session state after hydration; reading during render would mismatch SSR.
            setRequest(pending); setReason(pending.payload.reason)
            if (pending.action === 'recipe') {
                const quality = initialData.qualities.find(row => row.id === pending.payload.quality_id)
                if (quality) { setEntry({ kind: 'recipe', quality }); setCosting(pending.payload.costing_id) }
            } else {
                setEntry({ kind: pending.action, yarn: initialData.yarns.find(row => row.yarn_key === pending.payload.yarn_name.toLowerCase()) })
                setName(pending.payload.yarn_name); setWeight(String(pending.payload.weight_kg))
            }
        } catch { /* Session storage can be unavailable; in-memory retry still works. */ }
    }, [storageKey, initialData])

    async function load(asOf = data.as_of ?? '', yarnId = filter, more = false) {
        if (loading.current) return
        loading.current = true; setBusy(true); setError('')
        try {
            const result = await getYarnStockBoard({ asOf: asOf || undefined, yarnId: yarnId || undefined, cursor: more ? data.nextCursor ?? undefined : undefined })
            if ('error' in result) { setError(result.error); return }
            setFilter(yarnId)
            setData(previous => ({ ...result.data, movements: more ? [...previous.movements, ...result.data.movements.filter(row => !previous.movements.some(old => old.id === row.id))] : result.data.movements }))
        } catch { setError(text.loadError) }
        finally { loading.current = false; setBusy(false) }
    }
    const refresh = useRef<() => void>(() => {})
    useEffect(() => { refresh.current = () => { if (!document.hidden && !writing.current) void load() } })
    useEffect(() => {
        const run = () => refresh.current()
        window.addEventListener('focus', run); document.addEventListener('visibilitychange', run)
        return () => { window.removeEventListener('focus', run); document.removeEventListener('visibilitychange', run) }
    }, [])
    function open(value: Entry) {
        setEntry(value); setName(value.kind !== 'recipe' ? value.yarn?.yarn_name ?? '' : '')
        setWeight(value.kind === 'correction' ? String(value.yarn?.weight_kg ?? '') : '')
        setCosting(value.kind === 'recipe' ? value.quality.costing_id ?? '' : '')
        setReason(''); setSaveError(''); setRequest(null)
    }
    function clearRequest() { setRequest(null); try { sessionStorage.removeItem(storageKey) } catch {} }
    async function save() {
        if (!entry || writing.current) return
        const candidate = request ?? (entry.kind === 'recipe'
            ? { action: 'recipe' as const, requestId: crypto.randomUUID(), payload: { quality_id: entry.quality.id, costing_id: costing, expected_version: entry.quality.version, reason } }
            : { action: entry.kind, requestId: crypto.randomUUID(), payload: { yarn_name: name, weight_kg: weight.trim() ? Number(weight) : NaN, reason, expected_kg: entry.kind === 'correction' ? entry.yarn?.weight_kg : undefined } })
        const parsed = YarnMutationSchema.safeParse(candidate)
        if (!parsed.success) { setSaveError(text.validation); return }
        const input = parsed.data
        writing.current = true; setSaving(true); setRequest(input); setSaveError('')
        try { sessionStorage.setItem(storageKey, JSON.stringify(input)) } catch {}
        try {
            const result = await mutateYarnStock(input)
            if ('error' in result) { setSaveError(result.error); if (!result.uncertain) clearRequest(); return }
            clearRequest(); setEntry(null); setNotice(true); await load()
        } catch { setSaveError(text.retrySame) }
        finally { writing.current = false; setSaving(false) }
    }
    function download() {
        const url = URL.createObjectURL(new Blob([yarnAuditCsv(data)], { type: 'text/csv;charset=utf-8;' }))
        const link = document.createElement('a'); link.href = url; link.download = `yarn-stock-${data.as_of ?? 'current'}.csv`; link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    const current = !data.as_of
    const options = entry?.kind === 'recipe' ? data.costings.filter(row => row.quality_key === entry.quality.quality_key) : []
    const selected = options.find(row => row.id === costing)
    const names = [...new Set([...data.yarns.map(row => row.yarn_name), ...data.costings.flatMap(row => row.recipe.map(layer => layer.yarn_name))])].sort()
    return <div className="space-y-6" data-i18n-skip="true">
        <header className="grid gap-4 border-b border-hairline/80 pb-5 text-center sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:pb-6">
            <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:col-start-2 sm:row-start-1 sm:text-[2rem]">{text.title}</h1>
            <div className="flex flex-wrap justify-center gap-2 sm:col-start-3 sm:row-start-1 sm:justify-self-end">
                <Button asChild variant="outline" className="border-loom/30 text-loom hover:bg-loom/5 gap-1.5 font-medium">
                    <Link href="/owner/stock/audit">
                        <ClipboardCheck className="h-4 w-4" />
                        {t('qualityStock.audit')}
                    </Link>
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => void load()}>{text.refresh}</Button>{current && <><Button data-tour-anchor="yarn.opening" variant="outline" disabled={Boolean(request)} onClick={() => open({ kind: 'opening' })}>{text.opening}</Button><Button disabled={Boolean(request)} onClick={() => open({ kind: 'receipt' })}>{text.receipt}</Button></>}
            </div>
        </header>
        {notice && <p role="status" className="rounded-lg border border-[var(--wv-moss-200)] bg-[var(--wv-moss-50)] p-3 text-[var(--wv-moss-700)]">{text.saved}</p>}
        {error && <p role="alert" className="rounded-lg border border-[var(--wv-madder-200)] bg-[var(--wv-madder-50)] p-3 text-[var(--wv-madder-600)]">{error} <button className="underline" onClick={() => void load()}>{text.retry}</button></p>}
        {!data.started_at && <p className="rounded-lg border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] p-4 text-sm text-[var(--wv-ochre-800)]">{text.startHelp}</p>}
        <Card><CardContent className="space-y-2 p-6"><p className="text-sm text-muted-foreground">{text.total} · {data.as_of ?? text.current}</p><p className="text-3xl font-semibold tabular-nums">{kg(totalYarnKg(data.yarns))} kg</p>{data.started_at && <p className="text-xs text-muted-foreground">{text.started}: {dateTime(data.started_at)}</p>}</CardContent></Card>
        <section className="space-y-3 rounded-xl border p-4"><div className="flex flex-wrap items-end gap-3"><div className="space-y-2"><Label htmlFor="yarn-audit-date">{text.audit}</Label><Input id="yarn-audit-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div><Button disabled={busy} variant="outline" onClick={() => void load(date)}>{text.apply}</Button><Button disabled={busy} variant="outline" onClick={download}>{text.export}</Button></div><p className="text-xs text-muted-foreground">{text.auditHelp}</p></section>
        {data.yarns.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center">{text.empty}</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.yarns.map(yarn => <Card key={yarn.id}><CardContent className="space-y-3 p-5"><h2 className="break-words font-semibold">{yarn.yarn_name}</h2><p className="text-2xl font-semibold tabular-nums">{kg(yarn.weight_kg)} kg</p>{current && !yarn.opening_recorded && <p className="text-xs text-muted-foreground">{text.missing}</p>}
            <div className="flex flex-wrap gap-2">{current && <><Button size="sm" variant="outline" disabled={Boolean(request)} onClick={() => open({ kind: 'receipt', yarn })}>{text.receipt}</Button><Button size="sm" variant="outline" disabled={Boolean(request)} onClick={() => open({ kind: 'correction', yarn })}>{text.correction}</Button></>}<Button size="sm" variant="ghost" disabled={busy} onClick={() => void load(data.as_of ?? '', yarn.id)}>{text.history}</Button></div></CardContent></Card>)}</div>}
        {current && <section className="space-y-3"><h2 className="text-xl font-semibold">{text.formulas}</h2><p className="max-w-3xl text-sm text-muted-foreground">{text.formulaHelp}</p><div className="grid gap-3 sm:grid-cols-2">{data.qualities.map(quality => <Card key={quality.id}><CardContent className="space-y-3 p-5"><h3 className="font-semibold">{quality.quality_label}</h3>{quality.recipe ? <ul className="space-y-1 text-sm">{quality.recipe.map((row, index) => <li key={index}>{row.yarn_name} · {text[row.role]} · {kg(row.kg_per_100m)} {text.per100}</li>)}</ul> : <p className="text-sm text-[var(--wv-ochre-800)]">{text.unlinked}</p>}<Button size="sm" variant="outline" disabled={Boolean(request)} onClick={() => open({ kind: 'recipe', quality })}>{text.link}</Button></CardContent></Card>)}</div></section>}
        <section className="space-y-3" aria-busy={busy}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">{text.history}</h2><Label htmlFor="yarn-history-filter" className="sr-only">{text.name}</Label><select id="yarn-history-filter" value={filter} disabled={busy} className="max-w-full rounded-md border bg-background p-2 text-sm" onChange={e => void load(data.as_of ?? '', e.target.value)}><option value="">{text.all}</option>{data.yarns.map(row => <option key={row.id} value={row.id}>{row.yarn_name}</option>)}</select></div>
            {data.movements.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-muted-foreground">{text.noHistory}</p> : <ol className="divide-y rounded-xl border">{data.movements.map(row => {
                const usage = yarnMovementUsage(row, data.yarns)
                return <li key={row.id} className="flex flex-wrap justify-between gap-3 p-4">
                    <div className="min-w-0 space-y-1">
                        <p className="break-words font-medium">{row.yarn_name} · {text[row.kind]}</p>
                        <p className="max-w-xl break-words text-sm">{row.reason}</p>
                        <p className="text-xs text-muted-foreground">{dateTime(row.created_at)}</p>
                        {usage && <p className="text-xs text-muted-foreground">{kg(usage.meters)} m · {kg(usage.kgPer100m)} {text.per100}</p>}
                        {row.challan_id && <Link className="text-xs underline" href={`/owner/dispatches/${row.challan_id}/print`}>{text.viewDispatch}</Link>}
                    </div>
                    <div className="text-right tabular-nums">
                        <p className={row.kg_delta < 0 ? 'text-[var(--wv-madder-600)]' : 'text-[var(--wv-moss-700)]'}>{row.kg_delta > 0 ? '+' : ''}{kg(row.kg_delta)} kg</p>
                        <p className="text-xs text-muted-foreground">{text.balance}: {kg(row.balance_after)} kg</p>
                    </div>
                </li>
            })}</ol>}
            {data.nextCursor && <Button variant="outline" disabled={busy} onClick={() => void load(data.as_of ?? '', filter, true)}>{text.more}</Button>}
        </section>
        <Dialog open={Boolean(entry)} onOpenChange={value => { if (!value && !saving && !request) setEntry(null) }}><DialogContent showCloseButton={false} data-i18n-skip="true"><DialogHeader><DialogTitle>{entry?.kind === 'recipe' ? `${text.link} · ${entry.quality.quality_label}` : entry ? text[entry.kind] : ''}</DialogTitle><DialogDescription>{entry?.kind === 'recipe' ? text.formulaHelp : entry?.kind === 'opening' ? text.openingHelp : entry?.kind === 'correction' ? text.correctionHelp : text.receiptHelp}</DialogDescription></DialogHeader>
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); void save() }}>
                {entry?.kind === 'recipe' ? <><Label htmlFor="yarn-costing">{text.costing}</Label><select id="yarn-costing" className="w-full rounded-md border bg-background p-2" value={costing} disabled={Boolean(request)} onChange={e => setCosting(e.target.value)} required><option value="">{text.choose}</option>{options.map(row => <option key={row.id} value={row.id}>{row.quality_label} · v{row.version_number} · {dateTime(row.saved_at)}</option>)}</select>{options.length === 0 && <p className="text-sm text-[var(--wv-ochre-800)]">{text.noCostings} <Link className="underline" href="/owner/estimator">{text.costing}</Link></p>}{selected && <ul className="text-sm">{selected.recipe.map((row, index) => <li key={index}>{row.yarn_name} · {text[row.role]} · {kg(row.kg_per_100m)} {text.per100}</li>)}</ul>}</>
                    : <><div className="space-y-2"><Label htmlFor="yarn-name">{text.name}</Label><Input id="yarn-name" list="known-yarns" value={name} disabled={Boolean(request) || Boolean(entry && 'yarn' in entry && entry.yarn)} onChange={e => setName(e.target.value)} maxLength={160} required /><datalist id="known-yarns">{names.map(value => <option key={value} value={value} />)}</datalist></div><div className="space-y-2"><Label htmlFor="yarn-weight">{text.weight}</Label><Input id="yarn-weight" type="number" inputMode="decimal" min={entry?.kind === 'receipt' ? '0.001' : '0'} max="100000000" step="0.001" value={weight} disabled={Boolean(request)} onChange={e => setWeight(e.target.value)} required /></div></>}
                <div className="space-y-2"><Label htmlFor="yarn-reason">{entry?.kind === 'recipe' ? text.formulaReason : text.reason}</Label><textarea id="yarn-reason" className="min-h-20 w-full rounded-md border bg-background p-3 text-sm" value={reason} disabled={Boolean(request)} onChange={e => setReason(e.target.value)} minLength={3} maxLength={500} required /></div>
                {saveError && <p role="alert" className="text-sm text-[var(--wv-madder-600)]">{saveError}</p>}{request && !saving && <p className="text-xs text-muted-foreground">{text.retrySame}</p>}
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving || Boolean(request)} onClick={() => setEntry(null)}>{text.close}</Button><Button type="submit" disabled={saving || (entry?.kind === 'recipe' && !costing)}>{saving ? text.saving : request ? text.retry : text.save}</Button></div>
            </form>
        </DialogContent></Dialog>
    </div>
}
