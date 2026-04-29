'use client'

import { useState, useTransition } from 'react'
import { confirmDispatchReceipt } from '@/app/actions/track'
import type { TrackingData, TrackingDispatch } from './page'
import { format } from 'date-fns'
import { useTranslation } from '@/lib/i18n/context'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function progressBarColor(pct: number) {
    if (pct >= 90) return '#16a34a'   // green
    if (pct >= 50) return '#f59e0b'   // amber
    return '#6366f1'                  // indigo
}

function formatMeters(n: number) {
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso: string) {
    try { return format(new Date(iso), 'dd MMM yyyy') }
    catch { return iso }
}

// ─── Dispatch Card ─────────────────────────────────────────────────────────────

function DispatchCard({
    dispatch,
    trackingToken,
    orderCompleted,
    isPreview,
    onConfirmed,
}: {
    dispatch: TrackingDispatch
    trackingToken: string
    orderCompleted: boolean
    isPreview?: boolean
    onConfirmed: (id: string, qty: number) => void
}) {
    const { t } = useTranslation()
    const [expanded, setExpanded] = useState(false)
    const [qtyInput, setQtyInput] = useState(String(dispatch.qty_meters_sent))
    const [pending, startTransition] = useTransition()
    const [localError, setLocalError] = useState<string | null>(null)
    const [confirmed, setConfirmed] = useState(false)

    const isDelivered = dispatch.status === 'delivered' || confirmed
    const isInTransit = dispatch.status === 'in_transit' && !confirmed
    const canConfirm  = isInTransit && !orderCompleted

    const handleConfirm = () => {
        if (isPreview) return
        const qty = parseFloat(qtyInput)
        if (isNaN(qty) || qty < 0) {
            setLocalError('Enter a valid quantity')
            return
        }
        setLocalError(null)
        startTransition(async () => {
            const res = await confirmDispatchReceipt(dispatch.id, trackingToken, qty)
            if ('error' in res) {
                setLocalError(res.error)
            } else {
                setConfirmed(true)
                setExpanded(false)
                onConfirmed(dispatch.id, res.qty_received)
            }
        })
    }

    return (
        <div style={{
            background: '#fff',
            border: `1.5px solid ${isDelivered ? '#bbf7d0' : '#e2e8f0'}`,
            borderRadius: 16,
            padding: '16px 18px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            transition: 'border-color 0.2s',
        }}>
            {/* Batch header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                    <p style={{ fontWeight: 800, fontSize: 15, color: '#1e293b', margin: 0 }}>
                        Batch #{dispatch.dispatch_number}
                    </p>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0', fontFamily: 'monospace' }}>
                        {formatDate(dispatch.dispatched_at)}
                    </p>
                </div>
                <StatusBadge status={isDelivered ? 'delivered' : dispatch.status} />
            </div>

            {/* Meters row */}
            <div style={{ display: 'flex', gap: 20, marginBottom: canConfirm ? 12 : 0 }}>
                <div>
                    <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>Sent</p>
                    <p style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: '#1e293b', margin: 0 }}>
                        {formatMeters(dispatch.qty_meters_sent)}<span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}> m</span>
                    </p>
                </div>
                {isDelivered && (
                    <div>
                        <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>Received</p>
                        <p style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: '#16a34a', margin: 0 }}>
                            {formatMeters(dispatch.qty_meters_received ?? dispatch.qty_meters_sent)}<span style={{ fontSize: 11, color: '#86efac', fontWeight: 400 }}> m</span>
                        </p>
                    </div>
                )}
            </div>

            {/* Confirm Receipt button / expanded form */}
            {canConfirm && (
                <>
                    {!expanded ? (
                        <button
                            onClick={() => !isPreview && setExpanded(true)}
                            style={{
                                width: '100%',
                                padding: '10px 0',
                                background: isPreview ? '#f8fafc' : '#f0fdf4',
                                border: `1.5px solid ${isPreview ? '#e2e8f0' : '#86efac'}`,
                                borderRadius: 10,
                                color: isPreview ? '#94a3b8' : '#16a34a',
                                fontWeight: 700,
                                fontSize: 14,
                                cursor: isPreview ? 'default' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                transition: 'background 0.15s',
                            }}
                        >
                            {isPreview ? '✓ Trader will confirm receipt' : t('dispatch.receipt.recordButton')}
                        </button>
                    ) : (
                        <div style={{
                            background: '#f0fdf4',
                            border: '1.5px solid #86efac',
                            borderRadius: 10,
                            padding: '14px 16px',
                        }}>
                            <p style={{ fontSize: 12, color: '#15803d', fontWeight: 700, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Enter Meters Received
                            </p>
                            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                                <input
                                    type="number"
                                    value={qtyInput}
                                    onChange={e => { setQtyInput(e.target.value); setLocalError(null) }}
                                    step="0.01"
                                    min="0"
                                    max={dispatch.qty_meters_sent}
                                    style={{
                                        flex: 1,
                                        border: '1.5px solid #86efac',
                                        borderRadius: 8,
                                        padding: '10px 12px',
                                        fontSize: 16,
                                        fontFamily: 'monospace',
                                        fontWeight: 700,
                                        color: '#1e293b',
                                        background: '#fff',
                                        outline: 'none',
                                    }}
                                    placeholder={String(dispatch.qty_meters_sent)}
                                    autoFocus
                                />
                                <span style={{ fontSize: 12, color: '#64748b', alignSelf: 'center', fontWeight: 600 }}>m</span>
                            </div>
                            {localError && (
                                <p style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, margin: '0 0 8px' }}>⚠ {localError}</p>
                            )}
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    onClick={handleConfirm}
                                    disabled={pending}
                                    style={{
                                        flex: 1,
                                        padding: '11px 0',
                                        background: pending ? '#86efac' : '#16a34a',
                                        border: 'none',
                                        borderRadius: 10,
                                        color: '#fff',
                                        fontWeight: 800,
                                        fontSize: 14,
                                        cursor: pending ? 'wait' : 'pointer',
                                        transition: 'background 0.15s',
                                    }}
                                >
                                    {pending ? '⏳ Confirming…' : '✓ Confirm'}
                                </button>
                                <button
                                    onClick={() => { setExpanded(false); setLocalError(null) }}
                                    disabled={pending}
                                    style={{
                                        padding: '11px 16px',
                                        background: '#fff',
                                        border: '1.5px solid #cbd5e1',
                                        borderRadius: 10,
                                        color: '#64748b',
                                        fontWeight: 600,
                                        fontSize: 13,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {isDelivered && dispatch.receipt_confirmed_by_owner && (
                <div style={{
                    marginTop: 12,
                    background: '#f0fdf4',
                    border: '1.5px solid #bbf7d0',
                    borderRadius: 10,
                    padding: '10px 12px',
                }}>
                    <p style={{ fontSize: 12, color: '#15803d', fontWeight: 700, margin: 0 }}>
                        {t('dispatch.receipt.alreadyConfirmed')}
                    </p>
                </div>
            )}
        </div>
    )
}

// ─── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, { bg: string; color: string; label: string; icon: string }> = {
        in_transit: { bg: '#fff7ed', color: '#c2410c',  label: 'In Transit',  icon: '🚚' },
        delivered:  { bg: '#f0fdf4', color: '#15803d',  label: 'Received',    icon: '✅' },
        disputed:   { bg: '#fef3c7', color: '#92400e',  label: 'Disputed',    icon: '⚠️' },
    }
    const s = styles[status] ?? styles.in_transit
    return (
        <span style={{
            background: s.bg, color: s.color,
            fontWeight: 700, fontSize: 11, padding: '4px 10px',
            borderRadius: 20, whiteSpace: 'nowrap',
            border: `1px solid ${s.color}22`,
        }}>
            {s.icon} {s.label}
        </span>
    )
}

// ─── Main Portal ───────────────────────────────────────────────────────────────

export default function TrackingPortal({
    data: initialData,
    trackingToken,
    isPreview = false,
}: {
    data: TrackingData
    trackingToken: string
    isPreview?: boolean
}) {
    // Local state for optimistic updates after Trader confirms receipt
    const [data, setData] = useState<TrackingData>(initialData)

    const handleConfirmed = (id: string, qtyReceived: number) => {
        setData(prev => ({
            ...prev,
            dispatches: prev.dispatches.map(d =>
                d.id === id
                    ? { ...d, status: 'delivered', qty_meters_received: qtyReceived, received_at: new Date().toISOString(), receipt_confirmed_by_owner: false }
                    : d
            ),
        }))
    }

    const progressPct = data.total_target_meters > 0
        ? Math.min(100, (data.meters_produced / data.total_target_meters) * 100)
        : 0

    const totalSent = data.dispatches.reduce((s, d) => s + Number(d.qty_meters_sent), 0)
    const allDelivered = data.dispatches.length > 0 && data.dispatches.every(d => d.status === 'delivered')
    const orderCompleted = data.status === 'completed' || data.status === 'cancelled'

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #f8fafc 50%, #fafaf5 100%)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
            {/* ── Preview Mode Banner ───────────────────────────────────────── */}
            {isPreview && (
                <div style={{
                    background: '#fef3c7',
                    borderBottom: '1px solid #fde68a',
                    padding: '8px 20px',
                    textAlign: 'center',
                }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#92400e', margin: 0 }}>
                        👁️ Preview Mode: Viewing as Weaver. Interactive elements are disabled.
                    </p>
                </div>
            )}

            {/* ── Top Navigation Bar ────────────────────────────────────────── */}
            <div style={{
                background: '#1A5C38',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 32, height: 32,
                        background: 'rgba(255,255,255,0.15)',
                        borderRadius: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16,
                    }}>🏭</div>
                    <div>
                        <p style={{ color: '#fff', fontWeight: 800, fontSize: 14, margin: 0 }}>
                            {data.party_name}&apos;s Order
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, margin: 0 }}>
                            Tracked by Weavly
                        </p>
                    </div>
                </div>
                {orderCompleted && (
                    <span style={{
                        background: 'rgba(255,255,255,0.15)',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 10,
                        padding: '4px 10px',
                        borderRadius: 20,
                        border: '1px solid rgba(255,255,255,0.25)',
                    }}>
                        ✅ Order Complete
                    </span>
                )}
            </div>

            {/* ── Main Content ──────────────────────────────────────────────── */}
            <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 40px' }}>

                {/* ── Production Progress Card ─────────────────────────────── */}
                <div style={{
                    background: '#fff',
                    borderRadius: 18,
                    padding: '20px 20px 18px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                    marginBottom: 16,
                }}>
                    <p style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: '#94a3b8',
                        margin: '0 0 14px',
                    }}>
                        Production Progress
                    </p>

                    {/* Progress bar */}
                    <div style={{
                        height: 14,
                        background: '#f1f5f9',
                        borderRadius: 7,
                        overflow: 'hidden',
                        marginBottom: 10,
                    }}>
                        <div style={{
                            height: '100%',
                            width: `${progressPct}%`,
                            background: progressBarColor(progressPct),
                            borderRadius: 7,
                            transition: 'width 0.6s ease',
                        }} />
                    </div>

                    {/* Meters & Percentage */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <span style={{ fontSize: 24, fontWeight: 900, fontFamily: 'monospace', color: '#1e293b' }}>
                                {formatMeters(data.meters_produced)}
                            </span>
                            <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 400, marginLeft: 2 }}>
                                / {formatMeters(data.total_target_meters)} m
                            </span>
                        </div>
                        <span style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: progressBarColor(progressPct),
                            fontFamily: 'monospace',
                        }}>
                            {progressPct.toFixed(1)}%
                        </span>
                    </div>

                    {/* Order complete note */}
                    {orderCompleted && (
                        <div style={{
                            marginTop: 12,
                            padding: '8px 12px',
                            background: '#f0fdf4',
                            borderRadius: 10,
                            border: '1px solid #bbf7d0',
                        }}>
                            <p style={{ fontSize: 12, color: '#15803d', fontWeight: 700, margin: 0 }}>
                                ✅ Order complete — all fabric has been woven.
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Dispatches Section ───────────────────────────────────── */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <p style={{
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            color: '#94a3b8',
                            margin: 0,
                        }}>
                            Dispatches
                        </p>
                        {data.dispatches.length > 0 && (
                            <span style={{
                                fontSize: 11, fontWeight: 700, color: '#64748b',
                                background: '#f1f5f9', padding: '2px 10px', borderRadius: 20,
                            }}>
                                {data.dispatches.length} batch{data.dispatches.length !== 1 ? 'es' : ''}
                            </span>
                        )}
                    </div>

                    {/* All batches confirmed summary */}
                    {allDelivered && (
                        <div style={{
                            background: '#f0fdf4',
                            border: '1.5px solid #86efac',
                            borderRadius: 14,
                            padding: '14px 16px',
                            marginBottom: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                        }}>
                            <span style={{ fontSize: 24 }}>🎉</span>
                            <div>
                                <p style={{ fontWeight: 800, color: '#15803d', fontSize: 14, margin: 0 }}>All batches received!</p>
                                <p style={{ fontSize: 12, color: '#4ade80', margin: '2px 0 0' }}>
                                    Receipt confirmed for all dispatched fabric.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* No dispatches yet */}
                    {data.dispatches.length === 0 && (
                        <div style={{
                            background: '#fff',
                            borderRadius: 14,
                            padding: '28px 20px',
                            textAlign: 'center',
                            border: '1.5px dashed #e2e8f0',
                        }}>
                            <p style={{ fontSize: 28, margin: '0 0 8px' }}>🚚</p>
                            <p style={{ fontWeight: 700, color: '#64748b', fontSize: 14, margin: '0 0 4px' }}>
                                No dispatches yet
                            </p>
                            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                                The weaver will update this page when fabric is dispatched.
                            </p>
                        </div>
                    )}

                    {/* Dispatch cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {data.dispatches.map(dispatch => (
                            <DispatchCard
                                key={dispatch.id}
                                dispatch={dispatch}
                                trackingToken={trackingToken}
                                orderCompleted={orderCompleted}
                                isPreview={isPreview}
                                onConfirmed={handleConfirmed}
                            />
                        ))}
                    </div>
                </div>

                {/* ── Footer ──────────────────────────────────────────────── */}
                <div style={{ textAlign: 'center', marginTop: 32 }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 30,
                        padding: '6px 16px',
                    }}>
                        <span style={{ fontSize: 14 }}>🧵</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                            Powered by <span style={{ color: '#1A5C38' }}>Weavly</span>
                        </span>
                    </div>
                    <p style={{ fontSize: 10, color: '#cbd5e1', marginTop: 8 }}>
                        Real-time fabric order tracking for Surat&apos;s grey market.
                    </p>
                </div>
            </div>
        </div>
    )
}
