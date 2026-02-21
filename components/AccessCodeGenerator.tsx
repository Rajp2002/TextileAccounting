'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { generateAccessCode } from '@/app/(dashboard)/owner/actions'
import { KeyRound, Loader2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

export function AccessCodeGenerator() {
    const [loading, setLoading] = useState(false)
    const [generatedCode, setGeneratedCode] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    const handleGenerate = async () => {
        setLoading(true)
        setGeneratedCode(null)
        setCopied(false)
        try {
            const { code } = await generateAccessCode()
            setGeneratedCode(code)
            toast.success('New access code generated')
        } catch (error: any) {
            toast.error(error.message || 'Failed to generate code')
        } finally {
            setLoading(false)
        }
    }

    const handleCopy = async () => {
        if (!generatedCode) return
        await navigator.clipboard.writeText(generatedCode)
        setCopied(true)
        toast.success('Code copied to clipboard')
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Card className="border-red-100 shadow-sm">
            <CardHeader className="bg-red-50/50 pb-4">
                <CardTitle className="text-red-800 flex items-center gap-2">
                    <KeyRound className="h-5 w-5" />
                    Sensitive Actions Access Code
                </CardTitle>
                <CardDescription className="text-red-700/80">
                    Generate a single-use code for supervisors to delete records or edit past attendance.
                    Codes expire in 15 minutes.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <Button
                        onClick={handleGenerate}
                        disabled={loading}
                        variant="destructive"
                        className="w-full sm:w-auto"
                    >
                        {loading ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                        ) : (
                            'Generate New Code'
                        )}
                    </Button>

                    {generatedCode && (
                        <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                            <Input
                                value={generatedCode}
                                readOnly
                                className="font-mono font-bold tracking-widest text-center bg-gray-50 border-gray-300"
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={handleCopy}
                                title="Copy code"
                            >
                                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                    )}
                </div>
                {generatedCode && (
                    <p className="text-sm text-yellow-600 font-medium">
                        ⚠️ Copy this now. It won't be shown again.
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
