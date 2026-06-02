'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { requestOtherLanguage } from '@/app/(dashboard)/owner/actions/compliance'
import { toast } from 'sonner'
import { Loader2, Globe } from 'lucide-react'

const SCHEDULED_LANGUAGES = [
    { code: 'as', name: 'Assamese' },
    { code: 'bn', name: 'Bengali' },
    { code: 'brx', name: 'Bodo' },
    { code: 'doi', name: 'Dogri' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'hi', name: 'Hindi' },
    { code: 'kn', name: 'Kannada' },
    { code: 'ks', name: 'Kashmiri' },
    { code: 'kok', name: 'Konkani' },
    { code: 'mai', name: 'Maithili' },
    { code: 'ml', name: 'Malayalam' },
    { code: 'mni', name: 'Manipuri' },
    { code: 'mr', name: 'Marathi' },
    { code: 'ne', name: 'Nepali' },
    { code: 'or', name: 'Odia' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'sa', name: 'Sanskrit' },
    { code: 'sat', name: 'Santali' },
    { code: 'sd', name: 'Sindhi' },
    { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' },
    { code: 'ur', name: 'Urdu' },
]

interface LanguageRequestDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workerName?: string
}

export function LanguageRequestDialog({ open, onOpenChange, workerName }: LanguageRequestDialogProps) {
    const [selectedLang, setSelectedLang] = useState('')
    const [isPending, setIsPending] = useState(false)

    const handleRequest = async () => {
        if (!selectedLang) return
        setIsPending(true)
        try {
            const result = await requestOtherLanguage(selectedLang, workerName)
            if (result.error) throw new Error(result.error)
            
            toast.success('Language request logged. We will notify you when the translation is ready.')
            onOpenChange(false)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to log request')
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-blue-600" />
                        Request Other Language
                    </DialogTitle>
                    <DialogDescription>
                        Under DPDP Act 2026, workers have the right to receive notices in their native language.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Select Language</Label>
                        <Select value={selectedLang} onValueChange={setSelectedLang}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a language" />
                            </SelectTrigger>
                            <SelectContent>
                                {SCHEDULED_LANGUAGES.map((lang) => (
                                    <SelectItem key={lang.code} value={lang.code}>
                                        {lang.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {workerName && (
                        <p className="text-xs text-gray-500">
                            Requesting for: <span className="font-medium text-gray-900">{workerName}</span>
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button onClick={handleRequest} disabled={!selectedLang || isPending} className="bg-blue-600 hover:bg-blue-700">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Submit Request
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
