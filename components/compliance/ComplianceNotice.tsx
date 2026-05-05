'use client'

import { useState, useEffect, useRef } from 'react'
import { getActiveNotice } from '@/app/(dashboard)/owner/actions/compliance'
import { Button } from '@/components/ui/button'
import { Loader2, Volume2, Globe, AlertCircle, CheckCircle2 } from 'lucide-react'
import { LanguageRequestDialog } from './LanguageRequestDialog'
import { cn } from '@/lib/utils'

interface ComplianceNoticeProps {
    type: 'consent' | 'privacy' | 'erasure_notice'
    workerName?: string
    onConsentChange: (given: boolean, noticeId: string, granular?: Record<string, boolean>) => void
}

export function ComplianceNotice({ type, workerName, onConsentChange }: ComplianceNoticeProps) {
    const [notice, setNotice] = useState<any>(null)
    const [lang, setLang] = useState('en')
    const [loading, setLoading] = useState(true)
    const [requestDialogOpen, setRequestDialogOpen] = useState(false)
    const [granularConsent, setGranularConsent] = useState<Record<string, boolean>>({})
    const onConsentChangeRef = useRef(onConsentChange)

    useEffect(() => {
        onConsentChangeRef.current = onConsentChange
    }, [onConsentChange])

    useEffect(() => {
        async function fetchNotice() {
            setLoading(true)
            const data = await getActiveNotice(type, lang)
            setNotice(data)
            setLoading(false)
            if (data) {
                // Parse purposes from text: looks for (A), (B), etc.
                const purposes = data.body_text.match(/\(([A-Z])\)/g) || []
                const initialConsent: Record<string, boolean> = {}
                purposes.forEach((p: string) => {
                    const key = p.replace(/[()]/g, '')
                    initialConsent[key] = false
                })
                // If no (A)/(B) found, use a default 'ALL' key
                if (purposes.length === 0) initialConsent['ALL'] = false
                
                setGranularConsent(initialConsent)
                onConsentChangeRef.current(false, data.id, initialConsent)
            }
        }
        fetchNotice()
    }, [type, lang])

    const toggleConsent = (key: string) => {
        const next = { ...granularConsent, [key]: !granularConsent[key] }
        setGranularConsent(next)
        const allGiven = Object.values(next).every(v => v === true)
        onConsentChange(allGiven, notice?.id, next)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
        )
    }

    const purposeKeys = Object.keys(granularConsent)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Globe className="h-4 w-4" />
                    Notice Language
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={lang}
                        onChange={(e) => setLang(e.target.value)}
                        className="text-xs border rounded px-2 py-1 bg-white"
                    >
                        <option value="en">English</option>
                        <option value="hi">हिंदी (Hindi)</option>
                        <option value="gu">ગુજરાતી (Gujarati)</option>
                    </select>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-[10px] text-blue-600 hover:text-blue-700 p-0"
                        onClick={() => setRequestDialogOpen(true)}
                    >
                        Request Other
                    </Button>
                </div>
            </div>

            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-4">
                {notice ? (
                    <>
                        <div className="space-y-2">
                            <p className="text-sm text-blue-900 font-medium leading-relaxed">
                                {notice.body_text.split(/(\([A-Z]\))/g).map((part: string, i: number) => 
                                    /^\([A-Z]\)$/.test(part) ? (
                                        <span key={i} className="font-bold text-blue-700 bg-blue-100 px-1 rounded mx-0.5">{part}</span>
                                    ) : part
                                )}
                            </p>
                            {lang !== 'en' && notice.english_transcript && (
                                <p className="text-[10px] text-blue-500 italic">
                                    Transcript: {notice.english_transcript}
                                </p>
                            )}
                        </div>

                        {notice.content_audio_url && (
                            <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-blue-100 shadow-sm">
                                <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-full border-blue-200">
                                    <Volume2 className="h-4 w-4 text-blue-600" />
                                </Button>
                                <div className="flex-1">
                                    <div className="h-1 bg-blue-100 rounded-full overflow-hidden">
                                        <div className="w-1/3 h-full bg-blue-500" />
                                    </div>
                                </div>
                                <span className="text-[10px] font-mono text-blue-600">Audio Notice</span>
                            </div>
                        )}

                        <div className="space-y-3 pt-2">
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Granular Consent Required:</p>
                            {purposeKeys.map((key) => (
                                <div key={key} className="flex items-start gap-3 px-1">
                                    <button
                                        type="button"
                                        onClick={() => toggleConsent(key)}
                                        className={cn(
                                            "flex-shrink-0 mt-0.5 h-5 w-5 rounded border transition-colors flex items-center justify-center",
                                            granularConsent[key]
                                                ? "bg-green-600 border-green-600 text-white" 
                                                : "bg-white border-gray-300 hover:border-blue-400"
                                        )}
                                    >
                                        {granularConsent[key] && <CheckCircle2 className="h-3.5 w-3.5" />}
                                    </button>
                                    <div 
                                        className="text-xs text-gray-600 leading-snug cursor-pointer select-none"
                                        onClick={() => toggleConsent(key)}
                                    >
                                        {key === 'ALL' 
                                            ? `I confirm that the worker has ${notice.content_audio_url ? 'heard' : 'read'} and understood this notice.`
                                            : `I consent to purpose (${key}) as described in the notice.`
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center gap-2 text-amber-600 py-2">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-xs">No active notice found for this language.</span>
                    </div>
                )}
            </div>

            <LanguageRequestDialog 
                open={requestDialogOpen} 
                onOpenChange={setRequestDialogOpen} 
                workerName={workerName} 
            />
        </div>
    )
}
