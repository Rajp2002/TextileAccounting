'use client'

import { useState, useEffect } from 'react'
import { KeyRound, Copy, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getCurrentTimestampMs } from '@/lib/time'

function calculateTimeLeft(expiresAt: string) {
    const difference = Date.parse(expiresAt) - getCurrentTimestampMs()
    return Math.max(0, Math.floor(difference / 1000))
}

interface AccessCodeBannerProps {
    code: string
    expiresAt: string
}

export function AccessCodeBanner({ code, expiresAt }: AccessCodeBannerProps) {
    const [isVisible, setIsVisible] = useState(true)
    const [copied, setCopied] = useState(false)
    const [timeLeft, setTimeLeft] = useState(0)

    useEffect(() => {
        const updateTimeLeft = () => {
            const remaining = calculateTimeLeft(expiresAt)
            setTimeLeft(remaining)
            if (remaining <= 0) {
                setIsVisible(false)
            }
        }
        updateTimeLeft()

        const timer = setInterval(updateTimeLeft, 1000)

        return () => clearInterval(timer)
    }, [expiresAt])

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code)
        setCopied(true)
        toast.success('Access code copied to clipboard')
        setTimeout(() => setCopied(false), 2000)
    }

    if (!isVisible || timeLeft <= 0) return null

    const minutes = Math.floor(timeLeft / 60)
    const seconds = timeLeft % 60

    return (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:bottom-8 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white border-2 border-red-200 shadow-2xl rounded-2xl p-4 md:p-5 max-w-sm w-full relative overflow-hidden group">
                {/* Progress bar background */}
                <div className="absolute bottom-0 left-0 h-1 bg-red-100 w-full" />
                <div 
                    className="absolute bottom-0 left-0 h-1 bg-red-500 transition-all duration-1000 ease-linear" 
                    style={{ width: `${(timeLeft / 900) * 100}%` }} // Assuming 15 min max
                />

                <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
                        <KeyRound className="h-6 w-6 text-red-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                                Active Access Code
                            </span>
                            <button 
                                onClick={() => setIsVisible(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl font-black text-gray-900 tracking-widest font-mono">
                                {code}
                            </span>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 hover:bg-red-50 hover:text-red-600 shrink-0"
                                onClick={handleCopy}
                            >
                                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>

                        <p className="text-xs text-gray-500 font-medium">
                            Expires in <span className="text-red-600 font-bold">{minutes}:{seconds.toString().padStart(2, '0')}</span>. Forward this manually via WhatsApp.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
