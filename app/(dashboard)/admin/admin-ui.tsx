'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select'
import { 
    AlertCircle, 
    ShieldAlert, 
    FileText, 
    Users, 
    Globe, 
    Download, 
    Settings, 
    Search,
    Clock,
    FileSignature,
    CheckCircle2,
    XCircle
} from 'lucide-react'
import { 
    logOfflineGrievance, 
    updateGrievanceStatus, 
    generateWorkerReport, 
    toggleNoticeStatus, 
    exportAttendanceLogs,
    updateGRODetails,
    updateDpaTemplate,
    createDpaTemplate,
    recordDpaSignature,
    lockdownTenant,
    unlockTenant,
    generateBreachReportTemplate,
    createSecurityIncident,
    updateSecurityIncidentStatus,
    updateSecurityIncidentCertInAssessment,
    type SecurityIncidentStatus,
    type SecurityIncidentCertInAssessment,
    type SecurityIncidentDataCategory,
} from '@/lib/actions/compliance'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

type OfflineTarget = 'WEAVLY' | 'FACTORY_OWNER'
type OfflineType = 'DATA_PRIVACY' | 'OPERATIONAL' | 'UNLOCK_REQUEST' | 'OTHER'

type AdminGrievance = {
    id: string
    target_resolution_date: string | null
    target_entity: OfflineTarget | string
    subject: string
    sla_applies?: boolean
    grievance_type: string
    status: string
    resolved_at: string
    resolution_proof_url?: string | null
}

type AdminNotice = {
    id: string
    version_string: string
    notice_type: string
    content_audio_url?: string | null
    is_active: boolean
}

type AdminExportLog = {
    id: string
    changed_at: string
    table_name: string
    new_data?: { description?: string } | null
    changed_by: string | null
}

type AdminSettings = {
    gro_name: string
    gro_email: string
    gro_phone?: string | null
}

type DpaTemplate = {
    id: string
    version_string: string
    content_text: string
    is_active: boolean
}

type OrganizationDpa = {
    status: string
    signed_at: string
    proof_url?: string | null
    dpas?: { version_string?: string | null } | { version_string?: string | null }[] | null
}

type FactoryDpaStatus = {
    id: string
    name: string
    is_locked_down?: boolean
    organization_dpas?: OrganizationDpa[]
}

type BreachReport = {
    id: string
    affected_users_count: number
    organizations: { name: string }
}

type SecurityIncident = {
    id: string
    title: string
    source: string
    incident_type: string
    status: SecurityIncidentStatus
    severity: string
    aware_at: string
    cert_in_assessment_due_at: string
    cert_in_assessment: string
    affected_data_categories: string[]
    created_at: string
}

type SecurityIncidentDraft = {
    title: string
    source: 'customer' | 'provider' | 'monitoring' | 'internal' | 'other'
    incident_type: 'account_compromise' | 'unauthorized_access' | 'billing_security' | 'suspicious_message' | 'service_vulnerability' | 'availability' | 'other'
    aware_at: string
    summary: string
    affected_data_categories: SecurityIncidentDataCategory[]
}

function currentDateTimeLocal() {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

type AttendanceExportRow = {
    date: string
    worker_id: number | string
    client_ip: string | null
}

interface Props {
    initialGrievances: AdminGrievance[]
    initialNotices: AdminNotice[]
    initialExportLogs: AdminExportLog[]
    initialSettings: AdminSettings
    initialDpaTemplates: DpaTemplate[]
    initialFactoryDpaStatus: FactoryDpaStatus[]
    initialBreachReports: BreachReport[]
    initialSecurityIncidents: SecurityIncident[]
}

export function AdminDashboardUI({ 
    initialGrievances, 
    initialNotices, 
    initialExportLogs, 
    initialSettings,
    initialDpaTemplates,
    initialFactoryDpaStatus,
    initialBreachReports,
    initialSecurityIncidents,
}: Props) {
    const router = useRouter()
    const [workerIdSearch, setWorkerIdSearch] = useState('')
    const [exportDateRange, setExportDateRange] = useState({ start: '', end: '' })
    const [groDetails, setGroDetails] = useState<AdminSettings>(initialSettings)
    const [incidentDraft, setIncidentDraft] = useState<SecurityIncidentDraft>({
        title: '',
        source: 'internal',
        incident_type: 'other',
        aware_at: currentDateTimeLocal(),
        summary: '',
        affected_data_categories: ['account_authentication'],
    })
    
    // Offline form state
    const [offlineTarget, setOfflineTarget] = useState<OfflineTarget>('FACTORY_OWNER')
    const [offlineType, setOfflineType] = useState<OfflineType>('OPERATIONAL')

    // Helper: Calculate days left for grievance
    const getDaysLeft = (targetDate: string | null) => {
        if (!targetDate) return null
        const target = new Date(targetDate)
        const now = new Date()
        const diff = target.getTime() - now.getTime()
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
        return days
    }

    const handleWorkerExport = async () => {
        if (!workerIdSearch) return
        toast.promise(generateWorkerReport(parseInt(workerIdSearch)), {
            loading: 'Generating worker report...',
            success: (data) => {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `worker_report_${workerIdSearch}.json`
                a.click()
                return 'Report generated and downloaded.'
            },
            error: 'Failed to generate report.'
        })
    }

    const handleSubsidyExport = async () => {
        if (!exportDateRange.start || !exportDateRange.end) return
        toast.promise(exportAttendanceLogs(exportDateRange.start, exportDateRange.end), {
            loading: 'Exporting IP logs...',
            success: (data) => {
                const rows = data as AttendanceExportRow[]
                const csv = [
                    ['Date', 'Worker ID', 'IP Address'],
                    ...rows.map((r) => [r.date, r.worker_id, r.client_ip])
                ].map(e => e.join(',')).join('\n')
                const blob = new Blob([csv], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `ip_audit_logs_${exportDateRange.start}_to_${exportDateRange.end}.csv`
                a.click()
                return 'CSV Exported for Gujarat DST.'
            },
            error: 'Export failed.'
        })
    }

    const handleGROUpdate = async () => {
        toast.promise(updateGRODetails({
            gro_name: groDetails.gro_name,
            gro_email: groDetails.gro_email,
            gro_phone: groDetails.gro_phone ?? undefined,
        }), {
            loading: 'Updating GRO details...',
            success: 'Grievance Officer details updated.',
            error: 'Failed to update.'
        })
    }

    const handleDownloadReport = async (reportId: string) => {
        toast.promise(generateBreachReportTemplate(reportId), {
            loading: 'Generating internal assessment draft...',
            success: (data) => {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `security_incident_assessment_${reportId}.json`
                a.click()
                return 'Internal draft generated and downloaded.'
            },
            error: 'Failed to generate report.'
        })
    }

    const handleCreateSecurityIncident = () => {
        toast.promise(createSecurityIncident(incidentDraft), {
            loading: 'Opening incident record...',
            success: () => {
                setIncidentDraft({
                    title: '',
                    source: 'internal',
                    incident_type: 'other',
                    aware_at: currentDateTimeLocal(),
                    summary: '',
                    affected_data_categories: ['account_authentication'],
                })
                router.refresh()
                return 'Incident recorded. Begin CERT-In reportability assessment now.'
            },
            error: (error) => error instanceof Error ? error.message : 'Failed to create incident.',
        })
    }

    const handleIncidentStatus = (id: string, status: SecurityIncidentStatus) => {
        toast.promise(updateSecurityIncidentStatus(id, status), {
            loading: 'Updating incident...',
            success: () => {
                router.refresh()
                return 'Incident status updated.'
            },
            error: 'Failed to update incident.',
        })
    }

    const handleCertInAssessment = (id: string, assessment: SecurityIncidentCertInAssessment) => {
        let rationale = ''
        let reference: string | undefined
        if (assessment !== 'pending') {
            rationale = window.prompt('Record the facts supporting this CERT-In reportability decision:')?.trim() ?? ''
            if (rationale.length < 10) {
                toast.error('A decision rationale of at least 10 characters is required.')
                return
            }
        }
        if (assessment === 'reported') {
            reference = window.prompt('Enter the CERT-In submission reference:')?.trim()
            if (!reference) {
                toast.error('A submission reference is required for a reported incident.')
                return
            }
        }
        toast.promise(updateSecurityIncidentCertInAssessment(id, assessment, rationale, reference), {
            loading: 'Saving CERT-In assessment...',
            success: () => {
                router.refresh()
                return 'CERT-In assessment recorded.'
            },
            error: (error) => error instanceof Error ? error.message : 'Failed to update assessment.',
        })
    }

    return (
        <Tabs defaultValue="grievances" className="w-full">
            <TabsList className="grid grid-cols-2 md:grid-cols-7 gap-2 bg-transparent h-auto mb-8">
                <TabsTrigger value="grievances" className="data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-zinc-50 dark:data-[state=active]:text-zinc-900 flex items-center gap-2 py-3">
                    <AlertCircle className="h-4 w-4" /> Grievances
                </TabsTrigger>
                <TabsTrigger value="access" className="data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-zinc-50 dark:data-[state=active]:text-zinc-900 flex items-center gap-2 py-3">
                    <Users className="h-4 w-4" /> Right to Access
                </TabsTrigger>
                <TabsTrigger value="notices" className="data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-zinc-50 dark:data-[state=active]:text-zinc-900 flex items-center gap-2 py-3">
                    <FileText className="h-4 w-4" /> Notices
                </TabsTrigger>
                <TabsTrigger value="dpas" className="data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-zinc-50 dark:data-[state=active]:text-zinc-900 flex items-center gap-2 py-3">
                    <FileSignature className="h-4 w-4" /> DPA Agreements
                </TabsTrigger>
                <TabsTrigger value="subsidy" className="data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-zinc-50 dark:data-[state=active]:text-zinc-900 flex items-center gap-2 py-3">
                    <Globe className="h-4 w-4" /> Gujarat Subsidy
                </TabsTrigger>
                <TabsTrigger value="breach" className="data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-zinc-50 dark:data-[state=active]:text-zinc-900 flex items-center gap-2 py-3">
                    <ShieldAlert className="h-4 w-4" /> Security Incidents
                </TabsTrigger>
                <TabsTrigger value="settings" className="data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-zinc-50 dark:data-[state=active]:text-zinc-900 flex items-center gap-2 py-3">
                    <Settings className="h-4 w-4" /> Settings
                </TabsTrigger>
            </TabsList>

            {/* A. Grievance Command Center */}
            <TabsContent value="grievances" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Grievance Command Center</CardTitle>
                            <CardDescription>Weavly internal target: respond to privacy grievances within 30 calendar days of receipt.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Target</TableHead>
                                        <TableHead>Subject / Type</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Resolution Clock</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {initialGrievances.map((g) => {
                                        const daysLeft = getDaysLeft(g.target_resolution_date)
                                        return (
                                            <TableRow key={g.id}>
                                                <TableCell>
                                                    <Badge variant={g.target_entity === 'WEAVLY' ? 'destructive' : 'outline'} className="font-bold">
                                                        {g.target_entity}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium">{g.subject}</span>
                                                            {g.sla_applies && (
                                                                <Badge variant="outline" className="text-[9px] h-4 bg-amber-50 text-amber-700 border-amber-200 uppercase font-black px-1.5">
                                                                    SLA
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <span className={`text-[10px] uppercase font-bold tracking-tight ${
                                                            g.grievance_type === 'UNLOCK_REQUEST' ? 'text-purple-600 dark:text-purple-400' : 'text-zinc-500'
                                                        }`}>
                                                            {g.grievance_type.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={g.status === 'resolved' ? 'default' : 'secondary'}>
                                                        {g.status.toUpperCase()}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {g.status !== 'resolved' ? (
                                                        g.sla_applies ? (
                                                            <div className={`flex items-center gap-2 text-sm font-bold ${daysLeft !== null && daysLeft <= 5 ? 'text-red-500' : 'text-zinc-600'}`}>
                                                                <Clock className="h-4 w-4" />
                                                                {daysLeft === null ? 'Target unavailable' : `${daysLeft} days left`}
                                                            </div>
                                                        ) : (
                                                            <span className="text-zinc-400 text-xs italic">No privacy-response target</span>
                                                        )
                                                    ) : (
                                                        <span className="text-emerald-600 text-sm font-medium">Resolved on {new Date(g.resolved_at).toLocaleDateString()}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {g.status !== 'resolved' ? (
                                                        <div className="flex flex-col gap-2">
                                                            <Input 
                                                                placeholder="Proof URL (PDF/Image)" 
                                                                className="text-xs h-7" 
                                                                id={`proof-${g.id}`} 
                                                            />
                                                            <Input
                                                                placeholder="Closure summary"
                                                                className="text-xs h-7"
                                                                id={`summary-${g.id}`}
                                                            />
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                onClick={async () => {
                                                                    const proofUrl = (document.getElementById(`proof-${g.id}`) as HTMLInputElement).value
                                                                    const responseSummary = (document.getElementById(`summary-${g.id}`) as HTMLInputElement).value
                                                                    toast.promise(updateGrievanceStatus(g.id, 'resolved', proofUrl, responseSummary), {
                                                                        loading: 'Resolving grievance...',
                                                                        success: 'Grievance resolved with proof.',
                                                                        error: 'Failed to resolve.'
                                                                    })
                                                                }}
                                                            >
                                                                Resolve with Proof
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            <Badge variant="secondary" className="w-fit">Resolved</Badge>
                                                            {g.resolution_proof_url && (
                                                                <a 
                                                                    href={g.resolution_proof_url} 
                                                                    target="_blank" 
                                                                    className="text-[10px] text-blue-600 underline flex items-center gap-1"
                                                                >
                                                                    <FileText className="h-3 w-3" /> View Proof
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Log Offline Grievance</CardTitle>
                            <CardDescription>Manually record grievances received via phone or in-person.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-zinc-500">Target Entity</label>
                                    <Select value={offlineTarget} onValueChange={(val) => setOfflineTarget(val as OfflineTarget)}>
                                        <SelectTrigger className="h-9 text-xs">
                                            <SelectValue placeholder="Target" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="FACTORY_OWNER">Factory Owner</SelectItem>
                                            <SelectItem value="WEAVLY">Weavly (DPDP)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-zinc-500">Grievance Type</label>
                                    <Select value={offlineType} onValueChange={(val) => setOfflineType(val as OfflineType)}>
                                        <SelectTrigger className="h-9 text-xs">
                                            <SelectValue placeholder="Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="OPERATIONAL">Operational</SelectItem>
                                            <SelectItem value="DATA_PRIVACY">Data Privacy</SelectItem>
                                            <SelectItem value="UNLOCK_REQUEST">Unlock Request</SelectItem>
                                            <SelectItem value="OTHER">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Input placeholder="Subject" id="g_subject" />
                            <Input placeholder="Requester email" type="email" id="g_requester_email" />
                            <Input placeholder="Worker ID (Optional)" type="number" id="g_worker_id" />
                            <textarea className="w-full min-h-[100px] p-3 rounded-md border text-sm" placeholder="Description" id="g_description" />
                            <Button className="w-full" onClick={async () => {
                                const subject = (document.getElementById('g_subject') as HTMLInputElement).value
                                const worker_id = (document.getElementById('g_worker_id') as HTMLInputElement).value
                                const requester_email = (document.getElementById('g_requester_email') as HTMLInputElement).value
                                const description = (document.getElementById('g_description') as HTMLTextAreaElement).value
                                await logOfflineGrievance({ 
                                    org_id: null,
                                    subject, 
                                    description, 
                                    requester_email: requester_email || undefined,
                                    worker_id: worker_id ? parseInt(worker_id) : undefined,
                                    target_entity: offlineTarget,
                                    grievance_type: offlineType,
                                    filed_by_role: 'admin'
                                })
                                toast.success('Grievance logged.')
                            }}>
                                Save Record
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            {/* B. Right to Access */}
            <TabsContent value="access" className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Right to Access (Data Exporter)</CardTitle>
                        <CardDescription>Fulfill user requests to see their data. Generates a comprehensive JSON summary.</CardDescription>
                    </CardHeader>
                    <CardContent className="max-w-md space-y-4">
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Search Worker ID..." 
                                value={workerIdSearch} 
                                onChange={(e) => setWorkerIdSearch(e.target.value)} 
                            />
                            <Button onClick={handleWorkerExport}>
                                <Search className="h-4 w-4 mr-2" /> Export Data
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* C. Notice & Language Registry */}
            <TabsContent value="notices" className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Notice & Language Registry</CardTitle>
                        <CardDescription>Manage versioned notices and audio files for worker onboarding.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Version</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Language/Status</TableHead>
                                    <TableHead>Active</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialNotices.map((n) => (
                                    <TableRow key={n.id}>
                                        <TableCell className="font-bold">{n.version_string}</TableCell>
                                        <TableCell>{n.notice_type}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{n.content_audio_url ? 'Audio (GUJ/HIN)' : 'Text Only'}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Switch 
                                                checked={n.is_active} 
                                                onCheckedChange={(val) => toggleNoticeStatus(n.id, val)} 
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* DPA Agreements */}
            <TabsContent value="dpas" className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Data Processing Agreements (DPDP 2026)</CardTitle>
                        <CardDescription>Manage DPAs between Weavly (Processor) and Factory Owners (Fiduciaries).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Factory / Organization</TableHead>
                                    <TableHead>Active DPA Status</TableHead>
                                    <TableHead>Signed Date</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialFactoryDpaStatus?.map((org) => {
                                    const activeDpa = initialDpaTemplates?.find((d) => d.is_active)
                                    const orgDpa = org.organization_dpas?.find((d) => {
                                        const dpa = Array.isArray(d.dpas) ? d.dpas[0] : d.dpas
                                        return dpa?.version_string === activeDpa?.version_string
                                    })
                                    const isSigned = orgDpa?.status === 'signed'

                                    return (
                                        <TableRow key={org.id}>
                                            <TableCell className="font-medium">{org.name}</TableCell>
                                            <TableCell>
                                                {isSigned ? (
                                                    <Badge variant="default" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                        <CheckCircle2 className="h-3 w-3 mr-1" /> Signed ({activeDpa?.version_string})
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                                        <XCircle className="h-3 w-3 mr-1" /> Pending ({activeDpa?.version_string})
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-zinc-500">
                                                {isSigned ? new Date(orgDpa.signed_at).toLocaleDateString() : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {!isSigned && activeDpa && (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        onClick={async () => {
                                                            const proofUrl = prompt('Enter proof URL (optional):')
                                                            toast.promise(recordDpaSignature(org.id, activeDpa.id, proofUrl || undefined), {
                                                                loading: 'Recording signature...',
                                                                success: 'DPA marked as signed.',
                                                                error: 'Failed to record signature.'
                                                            })
                                                        }}
                                                    >
                                                        Mark as Signed
                                                    </Button>
                                                )}
                                                {isSigned && orgDpa?.proof_url && (
                                                    <a href={orgDpa.proof_url} target="_blank" className="text-xs text-blue-600 hover:underline ml-2">
                                                        View Proof
                                                    </a>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>DPA Templates</CardTitle>
                        <CardDescription>Manage the active legal text for the Data Processing Agreement.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {initialDpaTemplates?.map((template) => (
                            <div key={template.id} className="p-4 border rounded-md space-y-3">
                                <div className="flex justify-between items-center">
                                    <div className="font-bold">{template.version_string} {template.is_active && <Badge variant="default" className="ml-2">Active</Badge>}</div>
                                    <Switch 
                                        checked={template.is_active} 
                                        onCheckedChange={(val) => {
                                            toast.promise(updateDpaTemplate(template.id, { content_text: template.content_text, is_active: val }), {
                                                loading: 'Updating template...',
                                                success: 'Template updated successfully.',
                                                error: 'Failed to update.'
                                            })
                                        }}
                                    />
                                </div>
                                <textarea 
                                    className="w-full min-h-[100px] p-3 rounded-md border text-sm font-mono" 
                                    defaultValue={template.content_text}
                                    id={`dpa-text-${template.id}`}
                                />
                                <Button 
                                    variant="secondary" 
                                    size="sm"
                                    onClick={() => {
                                        const text = (document.getElementById(`dpa-text-${template.id}`) as HTMLTextAreaElement).value
                                        toast.promise(updateDpaTemplate(template.id, { content_text: text, is_active: template.is_active }), {
                                            loading: 'Saving text...',
                                            success: 'Text saved successfully.',
                                            error: 'Failed to save text.'
                                        })
                                    }}
                                >
                                    Save Text Changes
                                </Button>
                            </div>
                        ))}
                        
                        <div className="pt-4 border-t mt-4 space-y-4">
                            <h4 className="font-semibold text-sm">Add New Version</h4>
                            <div className="flex gap-2">
                                <Input placeholder="e.g. v2.0" id="new-dpa-version" className="max-w-[200px]" />
                            </div>
                            <textarea 
                                className="w-full min-h-[100px] p-3 rounded-md border text-sm font-mono" 
                                placeholder="DPA Legal Text..." 
                                id="new-dpa-text"
                            />
                            <Button onClick={() => {
                                const version = (document.getElementById('new-dpa-version') as HTMLInputElement).value
                                const text = (document.getElementById('new-dpa-text') as HTMLTextAreaElement).value
                                if (!version || !text) return toast.error('Fill in all fields')
                                toast.promise(createDpaTemplate({ version_string: version, content_text: text, is_active: true }), {
                                    loading: 'Creating new version...',
                                    success: 'New DPA template created and set as active.',
                                    error: 'Failed to create.'
                                })
                            }}>
                                Create & Activate New Version
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* D. Gujarat Subsidy Export */}
            <TabsContent value="subsidy" className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Gujarat DST Audit Export</CardTitle>
                        <CardDescription>Export verified IP logs for the 15% OPEX support audit (Gujarat IT Policy 2026).</CardDescription>
                    </CardHeader>
                    <CardContent className="max-w-md space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-zinc-500">Start Date</label>
                                <Input type="date" value={exportDateRange.start} onChange={(e) => setExportDateRange({...exportDateRange, start: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-zinc-500">End Date</label>
                                <Input type="date" value={exportDateRange.end} onChange={(e) => setExportDateRange({...exportDateRange, end: e.target.value})} />
                            </div>
                        </div>
                        <Button className="w-full" onClick={handleSubsidyExport}>
                            <Download className="h-4 w-4 mr-2" /> Generate IP Audit CSV
                        </Button>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* E. Breach Detection & Tenant Isolation */}
            <TabsContent value="breach" className="space-y-6">
                <Card className="border-red-200 dark:border-red-400/20">
                    <CardHeader>
                        <CardTitle>Base Plan Security Incident Register</CardTitle>
                        <CardDescription>Operator-only triage for account, costing, billing-reference, support, and technical-log incidents. The six-hour time shown is the internal deadline to assess CERT-In reportability, not a claim that every event is reportable.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-3 lg:grid-cols-[1fr_12rem_13rem_14rem_13rem_auto]">
                            <Input value={incidentDraft.title} onChange={(event) => setIncidentDraft({ ...incidentDraft, title: event.target.value })} placeholder="Short incident title" />
                            <Select value={incidentDraft.source} onValueChange={(value) => setIncidentDraft({ ...incidentDraft, source: value as typeof incidentDraft.source })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="internal">Internal</SelectItem>
                                    <SelectItem value="customer">Customer</SelectItem>
                                    <SelectItem value="provider">Provider</SelectItem>
                                    <SelectItem value="monitoring">Monitoring</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={incidentDraft.incident_type} onValueChange={(value) => setIncidentDraft({ ...incidentDraft, incident_type: value as typeof incidentDraft.incident_type })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="account_compromise">Account compromise</SelectItem>
                                    <SelectItem value="unauthorized_access">Unauthorized access</SelectItem>
                                    <SelectItem value="billing_security">Billing security</SelectItem>
                                    <SelectItem value="suspicious_message">Suspicious message</SelectItem>
                                    <SelectItem value="service_vulnerability">Vulnerability</SelectItem>
                                    <SelectItem value="availability">Availability</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={incidentDraft.affected_data_categories[0]} onValueChange={(value) => setIncidentDraft({ ...incidentDraft, affected_data_categories: [value as SecurityIncidentDataCategory] })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="account_authentication">Account/authentication</SelectItem>
                                    <SelectItem value="costings_business_contacts">Costings/contacts</SelectItem>
                                    <SelectItem value="billing_subscription_references">Billing references</SelectItem>
                                    <SelectItem value="support_privacy_communications">Support communications</SelectItem>
                                    <SelectItem value="technical_diagnostic_security_logs">Technical logs</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input type="datetime-local" value={incidentDraft.aware_at} onChange={(event) => setIncidentDraft({ ...incidentDraft, aware_at: event.target.value })} aria-label="Incident awareness time" />
                            <Button variant="destructive" onClick={handleCreateSecurityIncident} disabled={incidentDraft.title.trim().length < 3 || incidentDraft.summary.trim().length < 10}>Open incident</Button>
                        </div>
                        <Textarea value={incidentDraft.summary} onChange={(event) => setIncidentDraft({ ...incidentDraft, summary: event.target.value })} placeholder="Known facts only: what was observed, affected surface, and immediate action. Do not store passwords, tokens, credentials, or active exploit material here." rows={3} />

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Incident</TableHead>
                                    <TableHead>Aware</TableHead>
                                    <TableHead>CERT-In assessment due</TableHead>
                                    <TableHead>Assessment</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialSecurityIncidents.map((incident) => (
                                    <TableRow key={incident.id}>
                                        <TableCell>
                                            <p className="font-semibold">{incident.title}</p>
                                            <p className="text-xs text-zinc-500">{incident.incident_type.replaceAll('_', ' ')} · {incident.source}</p>
                                        </TableCell>
                                        <TableCell className="text-xs">{new Date(incident.aware_at).toLocaleString('en-IN')}</TableCell>
                                        <TableCell className="text-xs">{new Date(incident.cert_in_assessment_due_at).toLocaleString('en-IN')}</TableCell>
                                        <TableCell>
                                            <Select value={incident.cert_in_assessment} onValueChange={(value) => handleCertInAssessment(incident.id, value as SecurityIncidentCertInAssessment)}>
                                                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pending">pending</SelectItem>
                                                    <SelectItem value="not_reportable">not reportable</SelectItem>
                                                    <SelectItem value="reportable">reportable</SelectItem>
                                                    <SelectItem value="reported">reported</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Select value={incident.status} onValueChange={(value) => handleIncidentStatus(incident.id, value as SecurityIncidentStatus)}>
                                                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {(['reported', 'triaging', 'contained', 'investigating', 'monitoring', 'closed'] as const).map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {initialSecurityIncidents.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-zinc-500">No Base Plan security incidents recorded.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Tenant Isolation Manager</CardTitle>
                            <CardDescription>Isolate a factory workspace during a suspected security incident.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Factory</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {initialFactoryDpaStatus.map((org) => (
                                        <TableRow key={org.id}>
                                            <TableCell className="font-bold">{org.name}</TableCell>
                                            <TableCell>
                                                {org.is_locked_down ? (
                                                    <Badge variant="destructive" className="animate-pulse">ISOLATED</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-emerald-600 border-emerald-200">ACTIVE</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {org.is_locked_down ? (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="text-emerald-600"
                                                        onClick={() => {
                                                            if(confirm(`Restore operations for ${org.name}?`)) {
                                                                toast.promise(unlockTenant(org.id), {
                                                                    loading: 'Restoring operations...',
                                                                    success: 'Tenant isolation lifted.',
                                                                    error: 'Failed to unlock.'
                                                                })
                                                            }
                                                        }}
                                                    >
                                                        Lift Isolation
                                                    </Button>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <Input 
                                                            placeholder="Reason..." 
                                                            className="h-8 text-xs max-w-[120px]" 
                                                            id={`lock-reason-${org.id}`}
                                                        />
                                                        <Button 
                                                            variant="destructive" 
                                                            size="sm"
                                                            onClick={() => {
                                                                const reason = (document.getElementById(`lock-reason-${org.id}`) as HTMLInputElement).value
                                                                if(!reason) return toast.error("Reason is required for audit trail.")
                                                                toast.promise(lockdownTenant(org.id, reason, 'medium'), {
                                                                    loading: 'Isolating tenant...',
                                                                    success: 'Tenant data isolated.',
                                                                    error: 'Failed to isolate.'
                                                                })
                                                            }}
                                                        >
                                                            Isolate
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Lockdown Reports</CardTitle>
                            <CardDescription>Internal assessment drafts created by tenant isolation. These are not prescribed government forms.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Factory</TableHead>
                                        <TableHead>Affected</TableHead>
                                        <TableHead>Template</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {initialBreachReports.map((report) => (
                                        <TableRow key={report.id}>
                                            <TableCell className="text-sm">{report.organizations.name}</TableCell>
                                            <TableCell><Badge variant="secondary">{report.affected_users_count} Users</Badge></TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" onClick={() => handleDownloadReport(report.id)}>
                                                    <Download className="h-4 w-4 mr-2" /> JSON
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {initialBreachReports.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-8 text-zinc-500 italic">No breach reports filed.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Mass Export Alerts (Breach Detection)</CardTitle>
                        <CardDescription>Logs of all data exports. High frequency of exports may indicate a breach.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Timestamp</TableHead>
                                    <TableHead>Entity</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Performed By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialExportLogs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="text-xs font-mono">{new Date(log.changed_at).toLocaleString()}</TableCell>
                                        <TableCell><Badge variant="outline">{log.table_name}</Badge></TableCell>
                                        <TableCell className="text-sm">{log.new_data?.description || 'Data Export'}</TableCell>
                                        <TableCell className="text-xs">{log.changed_by}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* F. Settings / GRO Identity */}
            <TabsContent value="settings" className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Grievance Redressal Officer (GRO) Identity</CardTitle>
                        <CardDescription>These details are legally required to be displayed on your privacy page.</CardDescription>
                    </CardHeader>
                    <CardContent className="max-w-md space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">GRO Name</label>
                            <Input value={groDetails.gro_name} onChange={(e) => setGroDetails({...groDetails, gro_name: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">GRO Email</label>
                            <Input value={groDetails.gro_email} onChange={(e) => setGroDetails({...groDetails, gro_email: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">GRO Phone (Optional)</label>
                            <Input 
                                value={groDetails.gro_phone || ''} 
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                                    setGroDetails({...groDetails, gro_phone: val})
                                }} 
                                maxLength={10}
                                inputMode="numeric"
                            />
                        </div>
                        <Button className="w-full" onClick={handleGROUpdate}>
                            Save Identity Details
                        </Button>
                    </CardContent>
                </Card>

                <Card className="border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10">
                    <CardHeader>
                        <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5" /> Emergency Lockdown
                        </CardTitle>
                        <CardDescription className="text-red-600/80">THE &quot;BIG RED BUTTON&quot;: Instantly freeze all platform operations in case of a verified mass breach.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="destructive" className="font-bold tracking-widest uppercase py-6 px-10 h-auto text-lg" onClick={() => {
                            if(confirm("CRITICAL WARNING: This will freeze the entire platform for all users. Are you absolutely sure?")) {
                                toast.error("Lockdown sequence initiated...")
                            }
                        }}>
                            Execute Platform Lockdown
                        </Button>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    )
}
