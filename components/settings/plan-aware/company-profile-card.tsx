'use client'

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Building2, CheckCircle2, ImageUp, Loader2, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/context'
import { useSavedFlash } from '@/hooks/use-saved-flash'
import { brandingErrorText, brandingText, type BrandingCopyKey } from '@/lib/i18n/document-branding'
import { LOGO_ACCEPTED_MIME_TYPES, LOGO_MAX_UPLOAD_BYTES } from '@/lib/document-branding/limits'
import type { DocumentBrandingPreferences, DocumentBrandingSettingsView, LogoAssetView, LogoVariant } from '@/lib/document-branding/types'
import {
    approveLogo,
    getDocumentBrandingSettings,
    rejectLogoCandidate,
    removeActiveLogo,
    retryLogo,
    saveBrandingPreferences,
    saveBusinessProfile,
} from '@/app/(dashboard)/owner/settings/document-branding-actions'

type ProfileForm = {
    address: string
    gstin: string
    phone: string
    email: string
    bankDetails: string
    defaultQuotationTerms: string
}

type UploadState =
    | { phase: 'idle' }
    | { phase: 'uploading'; percent: number }
    | { phase: 'processing' }
    | { phase: 'error'; code: string }


function formFromView(view: DocumentBrandingSettingsView): ProfileForm {
    return { ...view.profile, defaultQuotationTerms: view.defaultQuotationTerms }
}

/** Upload with progress, so the owner sees the upload finish before processing starts. */
function uploadLogo(file: File, onProgress: (percent: number) => void, onUploaded: () => void): Promise<{ ok: boolean; code?: string }> {
    return new Promise(resolve => {
        const request = new XMLHttpRequest()
        request.open('POST', '/api/document-branding/logo')
        request.responseType = 'json'
        request.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)) }
        request.upload.onload = onUploaded
        request.onload = () => {
            const body = request.response as { ok?: boolean; code?: string } | null
            resolve(body && typeof body.ok === 'boolean' ? { ok: body.ok, code: body.code } : { ok: false, code: 'generic' })
        }
        request.onerror = () => resolve({ ok: false, code: 'generic' })
        const form = new FormData()
        form.append('file', file)
        request.send(form)
    })
}

export function CompanyProfileCard({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
    const { language } = useTranslation()
    const text = useCallback((key: BrandingCopyKey) => brandingText(language, key), [language])
    const [view, setView] = useState<DocumentBrandingSettingsView | null>(null)
    const [loadFailed, setLoadFailed] = useState(false)

    const load = useCallback(async () => {
        try {
            const result = await getDocumentBrandingSettings()
            if (result.ok) setView(result.data)
            else setLoadFailed(true)
        } catch {
            setLoadFailed(true)
        }
    }, [])

    useEffect(() => {
        let cancelled = false
        getDocumentBrandingSettings()
            .then(result => { if (cancelled) return; if (result.ok) setView(result.data); else setLoadFailed(true) })
            .catch(() => { if (!cancelled) setLoadFailed(true) })
        return () => { cancelled = true }
    }, [])

    return (
        <section id="company-profile" aria-labelledby="company-profile-heading" data-i18n-skip="true" className="scroll-mt-24 rounded-2xl border border-hairline bg-surface p-6 shadow-xs sm:p-8">
            <div className="space-y-1 border-b border-hairline/80 pb-4">
                <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-saffron-soft text-saffron-deep">
                        <Building2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h2 id="company-profile-heading" className="text-lg font-bold tracking-tight text-ink">{text('companyProfileTitle')}</h2>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{text('companyProfileSummary')}</p>
            </div>

            {!view && !loadFailed && (
                <div className="mt-6 space-y-3" aria-busy="true" aria-label={text('loading')}>
                    <Skeleton className="h-11 rounded-xl" />
                    <Skeleton className="h-24 rounded-xl" />
                    <Skeleton className="h-32 rounded-xl" />
                </div>
            )}
            {loadFailed && (
                <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-soft p-4 text-sm text-body">
                    {text('loadFailed')}
                    <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={() => { setLoadFailed(false); void load() }}>{text('retry')}</Button>
                </div>
            )}
            {view && !view.entitled && (
                <div className="mt-6 space-y-3 rounded-xl border border-hairline bg-surface-soft p-5">
                    <p className="font-semibold text-ink">{text('upgradeTitle')}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{text('upgradeBody')}</p>
                    <Button asChild className="min-h-11 rounded-xl"><Link href="/owner/billing">{text('upgradeCta')}</Link></Button>
                </div>
            )}
            {view && view.entitled && (
                <div className="mt-6 space-y-8">
                    <BusinessDetailsForm view={view} onSaved={load} onDirtyChange={onDirtyChange} />
                    <LogoSection view={view} onChanged={load} />
                </div>
            )}
        </section>
    )
}

function BusinessDetailsForm({ view, onSaved, onDirtyChange }: { view: DocumentBrandingSettingsView; onSaved: () => Promise<void>; onDirtyChange?: (dirty: boolean) => void }) {
    const { language } = useTranslation()
    const text = (key: BrandingCopyKey) => brandingText(language, key)
    const [justSaved, flashSaved] = useSavedFlash()
    const [saved, setSaved] = useState<ProfileForm>(() => formFromView(view))
    const [form, setForm] = useState<ProfileForm>(() => formFromView(view))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<{ code: string; field?: keyof ProfileForm } | null>(null)
    const ids = { address: useId(), gstin: useId(), phone: useId(), email: useId(), bank: useId(), terms: useId(), error: useId() }
    const dirty = (Object.keys(form) as Array<keyof ProfileForm>).some(key => form[key].trim() !== saved[key].trim())

    useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])

    const update = (key: keyof ProfileForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm(current => ({ ...current, [key]: event.target.value }))
        setError(null)
    }

    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        setSaving(true)
        setError(null)
        try {
            const result = await saveBusinessProfile(form)
            if (!result.ok) {
                const field = result.code === 'gstin_invalid' ? 'gstin' : result.code === 'phone_invalid' ? 'phone' : result.code === 'email_invalid' ? 'email' : undefined
                setError({ code: result.code, field })
                return
            }
            const normalised = { ...form, gstin: form.gstin.trim().toUpperCase() }
            setSaved(normalised)
            setForm(normalised)
            flashSaved()
            await onSaved()
        } catch {
            setError({ code: 'save_failed' })
        } finally {
            setSaving(false)
        }
    }

    const fieldError = (field: keyof ProfileForm) => error?.field === field
    const inputClass = 'h-11 rounded-xl border-hairline bg-surface text-sm focus-visible:border-loom'

    return (
        <form onSubmit={submit} className="space-y-5" aria-labelledby="business-details-heading">
            <div className="space-y-1">
                <h3 id="business-details-heading" className="text-base font-bold text-ink">{text('businessDetailsTitle')}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{text('businessDetailsHelp')} {text('businessNameNote')}</p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={ids.address} className="text-sm font-semibold text-ink">{text('address')}</Label>
                    <Textarea id={ids.address} value={form.address} onChange={update('address')} maxLength={400} rows={2} placeholder={text('addressPlaceholder')} disabled={saving} className="min-h-20 rounded-xl border-hairline" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={ids.gstin} className="text-sm font-semibold text-ink">{text('gstin')}</Label>
                    <Input id={ids.gstin} value={form.gstin} onChange={update('gstin')} maxLength={15} autoCapitalize="characters" spellCheck={false} placeholder="24ABCDE1234F1Z5" disabled={saving} aria-invalid={fieldError('gstin')} aria-describedby={fieldError('gstin') ? ids.error : undefined} className={cn(inputClass, 'uppercase')} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={ids.phone} className="text-sm font-semibold text-ink">{text('phone')}</Label>
                    <Input id={ids.phone} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={update('phone')} maxLength={40} disabled={saving} aria-invalid={fieldError('phone')} aria-describedby={fieldError('phone') ? ids.error : undefined} className={inputClass} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={ids.email} className="text-sm font-semibold text-ink">{text('email')}</Label>
                    <Input id={ids.email} type="email" inputMode="email" autoComplete="email" value={form.email} onChange={update('email')} maxLength={160} disabled={saving} aria-invalid={fieldError('email')} aria-describedby={fieldError('email') ? ids.error : undefined} className={inputClass} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={ids.bank} className="text-sm font-semibold text-ink">{text('bankDetails')}</Label>
                    <Textarea id={ids.bank} value={form.bankDetails} onChange={update('bankDetails')} maxLength={400} rows={2} placeholder={text('bankPlaceholder')} disabled={saving} aria-describedby={`${ids.bank}-help`} className="min-h-20 rounded-xl border-hairline" />
                    <p id={`${ids.bank}-help`} className="text-xs text-muted-foreground">{text('bankHelp')}</p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={ids.terms} className="text-sm font-semibold text-ink">{text('defaultTerms')}</Label>
                    <Textarea id={ids.terms} value={form.defaultQuotationTerms} onChange={update('defaultQuotationTerms')} maxLength={2000} rows={3} placeholder={text('termsPlaceholder')} disabled={saving} aria-describedby={`${ids.terms}-help`} className="min-h-24 rounded-xl border-hairline" />
                    <p id={`${ids.terms}-help`} className="text-xs text-muted-foreground">{text('termsHelp')}</p>
                </div>
            </div>
            {error && <p id={ids.error} role="alert" className="text-sm font-medium text-risk">{brandingErrorText(language, error.code)}</p>}
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-hairline/80 pt-4">
                {dirty && !saving && <span className="text-xs font-medium text-muted-foreground">{text('unsaved')}</span>}
                <Button type="submit" disabled={!dirty || saving} className={cn('min-h-11 rounded-xl px-5 font-bold', justSaved && !dirty && 'disabled:opacity-100')}>
                    {saving
                        ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{text('saving')}</>
                        : justSaved && !dirty
                            ? <><CheckCircle2 className="ui-success-pop h-4 w-4" aria-hidden="true" />{text('saved')}</>
                            : text('saveDetails')}
                </Button>
            </div>
        </form>
    )
}

function LogoSection({ view, onChanged }: { view: DocumentBrandingSettingsView; onChanged: () => Promise<void> }) {
    const { language } = useTranslation()
    const text = (key: BrandingCopyKey) => brandingText(language, key)
    const fileInput = useRef<HTMLInputElement>(null)
    const [upload, setUpload] = useState<UploadState>({ phase: 'idle' })
    const [busy, setBusy] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [confirmingRemove, setConfirmingRemove] = useState(false)
    const [dragging, setDragging] = useState(false)
    const candidate = view.candidate
    const active = view.activeLogo
    const uploading = upload.phase === 'uploading' || upload.phase === 'processing'

    const run = async (key: string, action: () => Promise<{ ok: boolean; code?: string }>) => {
        setBusy(key)
        setActionError(null)
        try {
            const result = await action()
            if (!result.ok) setActionError(result.code ?? 'generic')
            await onChanged()
        } catch {
            setActionError('generic')
        } finally {
            setBusy(null)
        }
    }

    const startUpload = async (file: File | undefined) => {
        if (!file || uploading) return
        // Quick checks here; the server checks the bytes again.
        if (!(LOGO_ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) return setUpload({ phase: 'error', code: 'unsupported_format' })
        if (file.size > LOGO_MAX_UPLOAD_BYTES) return setUpload({ phase: 'error', code: 'file_too_large' })
        setActionError(null)
        setUpload({ phase: 'uploading', percent: 0 })
        const result = await uploadLogo(
            file,
            percent => setUpload(current => current.phase === 'uploading' ? { phase: 'uploading', percent } : current),
            () => setUpload({ phase: 'processing' }),
        )
        await onChanged()
        setUpload(result.ok ? { phase: 'idle' } : { phase: 'error', code: result.code ?? 'generic' })
        if (fileInput.current) fileInput.current.value = ''
    }

    const pickFile = () => fileInput.current?.click()
    const uploadDisabled = uploading || busy !== null || !view.canManage

    return (
        <div className="space-y-5 border-t border-hairline/80 pt-6" aria-labelledby="factory-logo-heading">
            <div className="space-y-1">
                <h3 id="factory-logo-heading" className="text-base font-bold text-ink">{text('logoTitle')}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{text('logoIntro')}</p>
            </div>

            <input ref={fileInput} type="file" accept={LOGO_ACCEPTED_MIME_TYPES.join(',')} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={event => void startUpload(event.target.files?.[0])} />

            {active && (
                <div className="space-y-3 rounded-xl border border-hairline p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink">{text('activeTitle')}</p>
                        <p className="text-xs text-muted-foreground">{active.selectedVariant === 'svg' ? text('activeVersionTraced') : text('activeVersionOriginal')}</p>
                    </div>
                    <LogoPreview src={active.selectedVariant === 'svg' ? active.previews.svg : active.previews.raster} alt={text('activeTitle')} background="white" zoomed={false} />
                    {confirmingRemove ? (
                        <div role="alertdialog" aria-labelledby="remove-logo-question" className="space-y-3 rounded-lg bg-surface-soft p-3">
                            <p id="remove-logo-question" className="text-sm text-body">{text('removeConfirm')}</p>
                            <div className="flex flex-wrap gap-2">
                                <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={() => setConfirmingRemove(false)} disabled={busy !== null}>{text('cancel')}</Button>
                                <Button type="button" className="min-h-11 rounded-xl" disabled={busy !== null} onClick={() => void run('remove', async () => { const result = await removeActiveLogo(); setConfirmingRemove(false); return result })}>
                                    {busy === 'remove' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{text('confirmRemove')}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={pickFile} disabled={uploadDisabled}>{text('replace')}</Button>
                            {active.hasSvg && (
                                <Button type="button" variant="outline" className="min-h-11 rounded-xl" disabled={busy !== null} onClick={() => void run('switch', () => approveLogo({ assetId: active.id, variant: active.selectedVariant === 'svg' ? 'raster' : 'svg' }))}>
                                    {busy === 'switch' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                    {active.selectedVariant === 'svg' ? text('switchToOriginal') : text('switchToTraced')}
                                </Button>
                            )}
                            <Button type="button" variant="ghost" className="min-h-11 rounded-xl text-risk" onClick={() => setConfirmingRemove(true)} disabled={busy !== null}>{text('remove')}</Button>
                        </div>
                    )}
                </div>
            )}

            {candidate && !uploading
                ? <CandidateReview candidate={candidate} hasActive={Boolean(active)} busy={busy} onApprove={variant => void run('approve', () => approveLogo({ assetId: candidate.id, variant }))} onDiscard={() => void run('discard', () => rejectLogoCandidate({ assetId: candidate.id }))} onRetry={() => void run('retry', () => retryLogo({ assetId: candidate.id }))} />
                : (!active || uploading) && (
                    <div
                        onDragOver={event => { event.preventDefault(); if (!uploadDisabled) setDragging(true) }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={event => { event.preventDefault(); setDragging(false); if (!uploadDisabled) void startUpload(event.dataTransfer.files?.[0]) }}
                        className={cn('flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center transition-colors', dragging ? 'border-loom bg-surface-soft' : 'border-hairline')}
                    >
                        {uploading ? (
                            <div role="status" className="flex flex-col items-center gap-2 text-sm text-body">
                                <Loader2 className="h-5 w-5 animate-spin text-loom" aria-hidden="true" />
                                {upload.phase === 'uploading' ? `${text('uploading')} ${upload.percent}%` : text('processing')}
                            </div>
                        ) : (
                            <>
                                <ImageUp className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                                {!active && <p className="text-sm text-muted-foreground">{text('noLogo')}</p>}
                                <Button type="button" className="min-h-11 rounded-xl px-5" onClick={pickFile} disabled={uploadDisabled}>{text('chooseFile')}</Button>
                                <p className="hidden text-xs text-muted-foreground sm:block">{text('dropHint')}</p>
                                <p className="text-xs text-muted-foreground">{text('logoFormats')} {text('logoQualityTip')}</p>
                            </>
                        )}
                    </div>
                )}
            {active && candidate && !uploading && <p className="text-xs text-muted-foreground">{text('reviewHelp')}</p>}

            {upload.phase === 'error' && <p role="alert" className="text-sm font-medium text-risk">{brandingErrorText(language, upload.code)}</p>}
            {actionError && <p role="alert" className="text-sm font-medium text-risk">{brandingErrorText(language, actionError)}</p>}

            <DocumentToggles view={view} onSaved={onChanged} />
            <p className="text-xs text-muted-foreground">{text('poweredByNote')}</p>
        </div>
    )
}

function LogoPreview({ src, alt, background, zoomed }: { src: string | null; alt: string; background: 'white' | 'transparent'; zoomed: boolean }) {
    return (
        <div className={cn('flex h-36 items-center justify-center overflow-auto rounded-lg border border-hairline p-3', background === 'white' ? 'bg-white' : 'bg-[repeating-conic-gradient(#E9E4DA_0%_25%,#FFFFFF_0%_50%)] bg-[length:16px_16px] bg-center')}>
            {src
                // Signed preview URLs are rendered as images, never inlined, so a logo can't run markup.
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={src} alt={alt} className={cn('max-w-none object-contain', zoomed ? 'h-[220%]' : 'max-h-full max-w-full')} />
                : <span className="text-xs text-muted-foreground">—</span>}
        </div>
    )
}

function CandidateReview({ candidate, hasActive, busy, onApprove, onDiscard, onRetry }: {
    candidate: LogoAssetView
    hasActive: boolean
    busy: string | null
    onApprove: (variant: LogoVariant) => void
    onDiscard: () => void
    onRetry: () => void
}) {
    const { language } = useTranslation()
    const text = (key: BrandingCopyKey) => brandingText(language, key)
    const [background, setBackground] = useState<'white' | 'transparent'>('white')
    const [zoomed, setZoomed] = useState(false)

    if (candidate.status === 'failed' || candidate.status === 'processing' || candidate.status === 'uploaded') {
        const processing = candidate.status !== 'failed'
        return (
            <div role={processing ? 'status' : 'alert'} className="space-y-3 rounded-xl border border-hairline p-4">
                <p className="text-sm text-body">{processing ? text('processing') : `${text('processingFailed')} ${brandingErrorText(language, candidate.errorCode)}`}</p>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={onRetry} disabled={busy !== null}>
                        {busy === 'retry' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}{text('retryProcessing')}
                    </Button>
                    <Button type="button" variant="ghost" className="min-h-11 rounded-xl" onClick={onDiscard} disabled={busy !== null}>{text('discard')}</Button>
                </div>
            </div>
        )
    }

    const recommended = candidate.hasSvg ? candidate.recommendedVariant ?? 'raster' : 'raster'
    const versions: Array<{ variant: LogoVariant; label: string; src: string | null }> = [
        { variant: 'raster', label: text('originalLabel'), src: candidate.previews.original ?? candidate.previews.raster },
        ...(candidate.hasSvg ? [{ variant: 'svg' as const, label: text('tracedLabel'), src: candidate.previews.svg }] : []),
    ]

    return (
        <div className="space-y-4 rounded-xl border border-hairline p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-ink">{text('reviewTitle')}</p>
                    {!hasActive && <p className="text-xs text-muted-foreground">{text('reviewHelp')}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                    <div role="group" aria-label={text('onWhite')} className="flex rounded-xl border border-hairline p-0.5">
                        {(['white', 'transparent'] as const).map(option => (
                            <button key={option} type="button" aria-pressed={background === option} onClick={() => setBackground(option)} className={cn('min-h-10 rounded-lg px-3 text-xs font-semibold', background === option ? 'bg-ink text-surface' : 'text-body')}>
                                {option === 'white' ? text('onWhite') : text('onTransparent')}
                            </button>
                        ))}
                    </div>
                    <Button type="button" variant="outline" className="min-h-11 rounded-xl" aria-pressed={zoomed} onClick={() => setZoomed(value => !value)}>
                        {zoomed ? <ZoomOut className="h-4 w-4" aria-hidden="true" /> : <ZoomIn className="h-4 w-4" aria-hidden="true" />}{zoomed ? text('zoomOut') : text('zoomIn')}
                    </Button>
                </div>
            </div>
            <div className={cn('grid gap-4', versions.length > 1 && 'sm:grid-cols-2')}>
                {versions.map(version => (
                    <figure key={version.variant} className="space-y-2">
                        <figcaption className="flex items-center justify-between gap-2 text-xs font-semibold text-body">
                            {version.label}
                            {versions.length > 1 && version.variant === recommended && <span className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-saffron-deep">{text('recommended')}</span>}
                        </figcaption>
                        <LogoPreview src={version.src} alt={version.label} background={background} zoomed={zoomed} />
                    </figure>
                ))}
            </div>
            {!candidate.hasSvg && <p className="text-sm text-body">{text('traceFailed')}</p>}
            {candidate.hasSvg && recommended === 'raster' && <p className="text-sm text-body">{text('tracedNotRecommended')}</p>}
            <div className="flex flex-wrap gap-2">
                {[...versions].sort(version => version.variant === recommended ? -1 : 1).map(version => (
                    <Button key={version.variant} type="button" variant={version.variant === recommended ? 'default' : 'outline'} className="min-h-11 rounded-xl" disabled={busy !== null} onClick={() => onApprove(version.variant)}>
                        {busy === 'approve' && version.variant === recommended && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {version.variant === 'svg' ? text('useTraced') : text('useOriginal')}
                    </Button>
                ))}
                <Button type="button" variant="ghost" className="min-h-11 rounded-xl" onClick={onDiscard} disabled={busy !== null}>{text('discard')}</Button>
            </div>
        </div>
    )
}

function DocumentToggles({ view, onSaved }: { view: DocumentBrandingSettingsView; onSaved: () => Promise<void> }) {
    const { language } = useTranslation()
    const text = (key: BrandingCopyKey) => brandingText(language, key)
    const [preferences, setPreferences] = useState<DocumentBrandingPreferences>(view.preferences)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const toggle = async (key: keyof DocumentBrandingPreferences, value: boolean) => {
        const previous = preferences
        const next = { ...preferences, [key]: value }
        setPreferences(next)
        setSaving(true)
        setError(null)
        try {
            const result = await saveBrandingPreferences(next)
            if (!result.ok) {
                setPreferences(previous)
                setError(result.code)
            } else {
                await onSaved()
            }
        } catch {
            setPreferences(previous)
            setError('save_failed')
        } finally {
            setSaving(false)
        }
    }

    const rows: Array<[keyof DocumentBrandingPreferences, BrandingCopyKey]> = [
        ['quotationLogoEnabled', 'quotations'],
        ['internalCostSheetLogoEnabled', 'costSheets'],
        ['deliveryChallanLogoEnabled', 'challans'],
    ]

    return (
        <fieldset className="space-y-2" disabled={saving || !view.canManage}>
            <legend className="mb-2 text-sm font-semibold text-ink">{text('documentsTitle')}</legend>
            {rows.map(([key, label]) => (
                <label key={key} htmlFor={`branding-${key}`} className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-lg border border-hairline px-3 py-2">
                    <span className="text-sm text-body">{text(label)}</span>
                    <Switch id={`branding-${key}`} checked={preferences[key]} onCheckedChange={value => void toggle(key, value)} />
                </label>
            ))}
            {error && <p role="alert" className="text-sm font-medium text-risk">{brandingErrorText(language, error)}</p>}
        </fieldset>
    )
}
