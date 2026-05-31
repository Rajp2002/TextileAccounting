'use client'

import { useState, useTransition } from 'react'
import { MessageCircle, CheckCircle2, XCircle, Loader2, Phone } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { saveWhatsAppPreferences } from '@/app/(dashboard)/owner/actions'
import { useUserProfile } from '@/hooks/use-user-profile'
import { cn } from '@/lib/utils'

/**
 * WhatsApp opt-in card for the owner settings page.
 * Compliant with WhatsApp's opt-in policy — owner must explicitly save & enable.
 */
export function WhatsAppOptIn({ className }: { className?: string }) {
    const queryClient = useQueryClient()
    const { data: userProfile, isLoading } = useUserProfile()
    const [phone, setPhone] = useState('')
    const [isPending, startTransition] = useTransition()

    const isOptedIn = userProfile?.whatsapp_opted_in ?? false
    const existingPhone = userProfile?.whatsapp_number ?? ''

    function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
        // Only allow digits, max 10
        const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
        setPhone(digits)
    }

    function handleSave() {
        const phoneToSave = phone || existingPhone
        if (!phoneToSave || phoneToSave.length !== 10) {
            toast.error('Please enter a valid 10-digit mobile number')
            return
        }
        startTransition(async () => {
            const result = await saveWhatsAppPreferences(phoneToSave, true)
            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success('WhatsApp notifications enabled ✓')
                setPhone('')
                // Force React Query to refetch the profile so the badge updates
                queryClient.invalidateQueries({ queryKey: ['user_profile_id'] })
            }
        })
    }

    function handleOptOut() {
        startTransition(async () => {
            const result = await saveWhatsAppPreferences(existingPhone, false)
            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success('WhatsApp notifications disabled')
                // Force React Query to refetch the profile so the badge updates
                queryClient.invalidateQueries({ queryKey: ['user_profile_id'] })
            }
        })
    }

    if (isLoading) {
        return (
            <Card className={cn("rounded-lg border-hairline bg-surface/95 shadow-[var(--shadow-card)]", className)}>
                <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Loading WhatsApp settings…</span>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className={cn("rounded-lg border-hairline bg-surface/95 shadow-[var(--shadow-card)]", className)}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-success" />
                        <CardTitle className="text-base font-semibold">Daily WhatsApp Brief</CardTitle>
                    </div>
                    {isOptedIn ? (
                        <Badge variant="success" className="font-medium text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-gray-500 text-xs gap-1">
                            <XCircle className="h-3 w-3" />
                            Not enrolled
                        </Badge>
                    )}
                </div>
                <CardDescription>
                    {isOptedIn
                        ? `Receiving automated reports on +91 ${existingPhone} at 8:00 PM IST.`
                        : 'Get a factory summary — meters produced, yield efficiency, and wage totals — every evening at 8 PM.'}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Phone input */}
                <div className="space-y-2">
                    <Label htmlFor="wa-phone" className="text-sm font-medium">
                        Your WhatsApp Number
                    </Label>
                    <div className="flex gap-2">
                        <div className="flex items-center whitespace-nowrap rounded-md border border-hairline bg-surface-soft/55 px-3 text-sm font-medium text-body">
                            +91
                        </div>
                        <Input
                            id="wa-phone"
                            type="tel"
                            inputMode="numeric"
                            placeholder={existingPhone || '9898989898'}
                            value={phone}
                            onChange={handlePhoneChange}
                            maxLength={10}
                            className="border-hairline bg-canvas/80 font-mono tracking-wider"
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        10-digit Indian mobile number, without country code.
                    </p>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button
                        onClick={handleSave}
                        disabled={isPending}
                        size="sm"
                        className="gap-2 bg-success text-white hover:bg-success/90"
                    >
                        {isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Phone className="h-3.5 w-3.5" />
                        )}
                        {isOptedIn ? 'Update Number' : 'Save & Enable'}
                    </Button>

                    {isOptedIn && (
                        <Button
                            onClick={handleOptOut}
                            disabled={isPending}
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:bg-risk-soft hover:text-risk"
                        >
                            Disable Notifications
                        </Button>
                    )}
                </div>

                {/* Legal disclaimer */}
                <p className="border-t border-hairline/70 pt-3 text-xs leading-relaxed text-subtle">
                    By saving, you agree to receive automated WhatsApp messages from Weavly about
                    your factory activity. Messages are sent only at scheduled times or when
                    critical events occur. Standard WhatsApp rates may apply.
                    You can opt out any time using the button above.
                </p>
            </CardContent>
        </Card>
    )
}
