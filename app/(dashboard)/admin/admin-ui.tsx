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
    AlertCircle, 
    ShieldAlert, 
    FileText, 
    Users, 
    Globe, 
    Download, 
    History, 
    Settings, 
    Search,
    Clock
} from 'lucide-react'
import { 
    logOfflineGrievance, 
    updateGrievanceStatus, 
    generateWorkerReport, 
    toggleNoticeStatus, 
    exportAttendanceLogs,
    updateGRODetails
} from '@/lib/actions/compliance'
import { toast } from 'sonner'

interface Props {
    initialGrievances: any[]
    initialNotices: any[]
    initialExportLogs: any[]
    initialSettings: any
}

export function AdminDashboardUI({ 
    initialGrievances, 
    initialNotices, 
    initialExportLogs, 
    initialSettings 
}: Props) {
    const [workerIdSearch, setWorkerIdSearch] = useState('')
    const [exportDateRange, setExportDateRange] = useState({ start: '', end: '' })
    const [groDetails, setGroDetails] = useState(initialSettings)

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
                                        <TableHead>Subject</TableHead>
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
                                                <TableCell className="font-medium">{g.subject}</TableCell>
                                                <TableCell>
                                                    <Badge variant={g.status === 'resolved' ? 'default' : 'destructive'}>
                                                        {g.status.toUpperCase()}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {g.status !== 'resolved' ? (
                                                        <div className={`flex items-center gap-2 text-sm font-bold ${daysLeft <= 2 ? 'text-red-500' : 'text-zinc-600'}`}>
                                                            <Clock className="h-4 w-4" />
                                                            {daysLeft} days left
                                                        </div>
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
                            <Input placeholder="Subject" id="g_subject" />
                            <Input placeholder="Worker ID (Optional)" type="number" id="g_worker_id" />
                            <textarea className="w-full min-h-[100px] p-3 rounded-md border text-sm" placeholder="Description" id="g_description" />
                            <Button className="w-full" onClick={async () => {
                                const subject = (document.getElementById('g_subject') as HTMLInputElement).value
                                const worker_id = (document.getElementById('g_worker_id') as HTMLInputElement).value
                                const description = (document.getElementById('g_description') as HTMLTextAreaElement).value
                                await logOfflineGrievance({ org_id: 'GLOBAL', subject, description, worker_id: worker_id ? parseInt(worker_id) : undefined })
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

            {/* E. Breach Detection */}
            <TabsContent value="breach" className="space-y-6">
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
                            <Input value={groDetails.gro_phone || ''} onChange={(e) => setGroDetails({...groDetails, gro_phone: e.target.value})} />
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
                        <CardDescription className="text-red-600/80">THE "BIG RED BUTTON": Instantly freeze all platform operations in case of a verified mass breach.</CardDescription>
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
