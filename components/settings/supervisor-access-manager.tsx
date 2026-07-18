'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    AlertTriangle,
    Building2,
    Loader2,
    ShieldCheck,
    Trash2,
    UserRoundCheck,
    Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    getConnectedSupervisors,
    removeSupervisorAccess,
    type ConnectedSupervisor,
} from '@/app/(dashboard)/owner/settings/supervisor-access-actions'

function initials(name: string) {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'S'
}

export function SupervisorAccessManager({ factoryName }: { factoryName: string }) {
    const queryClient = useQueryClient()
    const [selectedSupervisor, setSelectedSupervisor] = useState<ConnectedSupervisor | null>(null)
    const [confirmationName, setConfirmationName] = useState('')

    const supervisorsQuery = useQuery({
        queryKey: ['connected-supervisors'],
        queryFn: async () => {
            const result = await getConnectedSupervisors()
            if (result.error) throw new Error(result.error)
            return result.data
        },
    })

    const removeMutation = useMutation({
        mutationFn: async (supervisor: ConnectedSupervisor) => {
            const result = await removeSupervisorAccess(supervisor.id, confirmationName)
            if ('error' in result) throw new Error(result.error)
            return result
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['connected-supervisors'] })
            toast.success('Supervisor access removed. Historical factory records were preserved.')
            setSelectedSupervisor(null)
            setConfirmationName('')
        },
        onError: (error: unknown) => {
            toast.error(error instanceof Error ? error.message : 'Unable to remove supervisor access.')
        },
    })

    const canConfirm = useMemo(() => {
        if (!selectedSupervisor) return false
        return confirmationName.trim().toLocaleLowerCase() === selectedSupervisor.fullName.toLocaleLowerCase()
    }, [confirmationName, selectedSupervisor])

    function closeDialog() {
        if (removeMutation.isPending) return
        setSelectedSupervisor(null)
        setConfirmationName('')
    }

    return (
        <>
            <div className="overflow-hidden rounded-lg border border-hairline bg-surface/95 shadow-[var(--shadow-card)] backdrop-blur-sm">
                <div className="flex flex-col gap-3 border-b border-hairline p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-saffron" />
                            <h3 className="text-base font-semibold text-ink">Connected supervisors</h3>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            Review who can enter production and factory-floor records for this factory.
                        </p>
                    </div>
                    {!supervisorsQuery.isLoading && !supervisorsQuery.isError && (
                        <Badge variant="outline" className="w-fit">
                            {supervisorsQuery.data?.length ?? 0} connected
                        </Badge>
                    )}
                </div>

                <div className="p-5 sm:p-6">
                    {supervisorsQuery.isLoading && (
                        <div className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading connected supervisors
                        </div>
                    )}

                    {supervisorsQuery.isError && (
                        <div className="rounded-lg border border-danger/20 bg-danger-soft p-4">
                            <p className="text-sm font-medium text-danger">
                                {supervisorsQuery.error instanceof Error
                                    ? supervisorsQuery.error.message
                                    : 'Unable to load connected supervisors.'}
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-3"
                                onClick={() => supervisorsQuery.refetch()}
                            >
                                Try again
                            </Button>
                        </div>
                    )}

                    {!supervisorsQuery.isLoading && !supervisorsQuery.isError && supervisorsQuery.data?.length === 0 && (
                        <div className="flex flex-col items-center rounded-lg border border-dashed border-hairline bg-surface-soft/45 px-5 py-8 text-center">
                            <UserRoundCheck className="h-8 w-8 text-muted-foreground" />
                            <h4 className="mt-3 font-semibold text-ink">No supervisors connected yet</h4>
                            <p className="mt-1 max-w-md text-sm text-muted-foreground">
                                Share the factory join code above when you are ready to connect a supervisor account.
                            </p>
                        </div>
                    )}

                    {!supervisorsQuery.isLoading && !supervisorsQuery.isError && (supervisorsQuery.data?.length ?? 0) > 0 && (
                        <div className="space-y-3">
                            {supervisorsQuery.data?.map((supervisor) => (
                                <div
                                    key={supervisor.id}
                                    className="flex flex-col gap-4 rounded-lg border border-hairline bg-canvas/55 p-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info-soft text-sm font-bold text-info">
                                            {initials(supervisor.fullName)}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="truncate font-semibold text-ink">{supervisor.fullName}</p>
                                                <Badge variant="success">
                                                    <ShieldCheck className="h-3 w-3" />
                                                    Connected
                                                </Badge>
                                            </div>
                                            <p className="mt-1 truncate text-sm text-muted-foreground">
                                                {[supervisor.email, supervisor.phone].filter(Boolean).join(' · ') || 'No contact details'}
                                            </p>
                                            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                                <Building2 className="h-3 w-3" />
                                                {factoryName}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-danger/25 text-danger hover:bg-danger-soft hover:text-danger sm:w-auto"
                                        onClick={() => setSelectedSupervisor(supervisor)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Remove access
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={!!selectedSupervisor} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-danger">
                            <AlertTriangle className="h-5 w-5" />
                            Remove supervisor access?
                        </DialogTitle>
                        <DialogDescription>
                            {selectedSupervisor?.fullName} will no longer be able to sign in or access this factory.
                            Their historical production, attendance, cash, and audit records will be preserved.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2 py-2">
                        <Label htmlFor="supervisor-removal-confirmation">
                            Type <span className="font-bold text-ink">{selectedSupervisor?.fullName}</span> to confirm
                        </Label>
                        <Input
                            id="supervisor-removal-confirmation"
                            autoComplete="off"
                            value={confirmationName}
                            onChange={(event) => setConfirmationName(event.target.value)}
                            disabled={removeMutation.isPending}
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog} disabled={removeMutation.isPending}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={!canConfirm || removeMutation.isPending || !selectedSupervisor}
                            onClick={() => selectedSupervisor && removeMutation.mutate(selectedSupervisor)}
                        >
                            {removeMutation.isPending
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Trash2 className="h-4 w-4" />}
                            {removeMutation.isPending ? 'Removing access...' : 'Remove access'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
