'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
    History, 
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
    generateBreachReportTemplate
} from '@/lib/actions/compliance'
import { toast } from 'sonner'

interface Props {
    initialGrievances: any[]
    initialNotices: any[]
    initialExportLogs: any[]
    initialSettings: any
    initialDpaTemplates: any[]
    initialFactoryDpaStatus: any[]
    initialBreachReports: any[]
}

export function AdminDashboardUI({ 
    initialGrievances, 
    initialNotices, 
    initialExportLogs, 
    initialSettings,
    initialDpaTemplates,
    initialFactoryDpaStatus,
    initialBreachReports
}: Props) {
    const [workerIdSearch, setWorkerIdSearch] = useState('')
    const [exportDateRange, setExportDateRange] = useState({ start: '', end: '' })
    const [groDetails, setGroDetails] = useState(initialSettings)
    
    // Offline form state
    const [offlineTarget, setOfflineTarget] = useState<'WEAVLY' | 'FACTORY_OWNER'>('FACTORY_OWNER')
    const [offlineType, setOfflineType] = useState<'DATA_PRIVACY' | 'OPERATIONAL' | 'OTHER'>('OPERATIONAL')

    // Lockdown form state
    const [lockdownReason, setLockdownReason] = useState('')
    const [lockdownSeverity, setLockdownSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')

    // Helper: Calculate days left for grievance
    const getDaysLeft = (targetDate: string) => {
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
                const csv = [
                    ['Date', 'Worker ID', 'IP Address'],
                    ...data.map((r: any) => [r.date, r.worker_id, r.client_ip])
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
        toast.promise(updateGRODetails(groDetails), {
            loading: 'Updating GRO details...',
            success: 'Grievance Officer details updated.',
            error: 'Failed to update.'
        })
    }

    const handleDownloadReport = async (reportId: string) => {
        toast.promise(generateBreachReportTemplate(reportId), {
            loading: 'Generating DPDP filing template...',
            success: (data) => {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `DPDP_Breach_Report_${reportId}.json`
                a.click()
                return 'Report generated and downloaded.'
            },
            error: 'Failed to generate report.'
        })
    }

    return (
        <Tabs defaultValue="grievances" className="w-full">
            <TabsList className="grid grid-cols-2 md:grid-cols-6 gap-2 bg-transparent h-auto mb-8">
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
                    <ShieldAlert className="h-4 w-4" /> Breach/Audit
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
                            <CardDescription>DPDP Act Requirement: Resolve all grievances within 7 days.</CardDescription>
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
                                                            <div className={`flex items-center gap-2 text-sm font-bold ${daysLeft <= 2 ? 'text-red-500' : 'text-zinc-600'}`}>
                                                                <Clock className="h-4 w-4" />
                                                                {daysLeft} days left
                                                            </div>
                                                        ) : (
                                                            <span className="text-zinc-400 text-xs italic">No strict SLA</span>
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
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                onClick={async () => {
                                                                    const proofUrl = (document.getElementById(`proof-${g.id}`) as HTMLInputElement).value
                                                                    toast.promise(updateGrievanceStatus(g.id, 'resolved', proofUrl), {
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
                                    <Select value={offlineTarget} onValueChange={(val: any) => setOfflineTarget(val)}>
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
                                    <Select value={offlineType} onValueChange={(val: any) => setOfflineType(val)}>
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
                            <Input placeholder="Worker ID (Optional)" type="number" id="g_worker_id" />
                            <textarea className="w-full min-h-[100px] p-3 rounded-md border text-sm" placeholder="Description" id="g_description" />
                            <Button className="w-full" onClick={async () => {
                                const subject = (document.getElementById('g_subject') as HTMLInputElement).value
                                const worker_id = (document.getElementById('g_worker_id') as HTMLInputElement).value
                                const description = (document.getElementById('g_description') as HTMLTextAreaElement).value
                                await logOfflineGrievance({ 
                                    org_id: 'GLOBAL', 
                                    subject, 
                                    description, 
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
                                    const activeDpa = initialDpaTemplates?.find((d: any) => d.is_active)
                                    const orgDpa = org.organization_dpas?.find((d: any) => d.dpas?.version_string === activeDpa?.version_string)
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
                        {initialDpaTemplates?.map((template: any) => (
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Tenant Isolation Manager</CardTitle>
                            <CardDescription>DPDP 2026: Isolate specific factory data during a suspected breach.</CardDescription>
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
                            <CardTitle>DPDP 2026 Breach Reports</CardTitle>
                            <CardDescription>Auto-generated filings for the Data Protection Board.</CardDescription>
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
                                    {initialBreachReports.map((report: any) => (
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
