'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import AuditDiff from '@/components/ui/audit-diff'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from '@/components/ui/button'

const PAGE_SIZE = 20

export default function AuditTable() {
    const supabase = createClient()
    const { data: userProfile } = useUserProfile()

    const [page, setPage] = useState(0)
    const [actionFilter, setActionFilter] = useState<string>('all')
    const [tableFilter, setTableFilter] = useState<string>('all')

    const { data, isLoading } = useQuery({
        queryKey: ['auditLogs', userProfile?.org_id, page, actionFilter, tableFilter],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            let query = supabase
                .from('audit_log')
                .select('*, profiles!audit_log_changed_by_fkey(name, role)', { count: 'exact' })
                .eq('org_id', userProfile!.org_id)
                .order('changed_at', { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

            if (actionFilter !== 'all') {
                query = query.eq('action', actionFilter)
            }
            if (tableFilter !== 'all') {
                query = query.eq('table_name', tableFilter)
            }

            const { data, error, count } = await query
            if (error) throw error
            return { items: data, count }
        }
    })

    const ActionBadge = ({ action }: { action: string }) => {
        switch (action) {
            case 'INSERT': return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">INSERT</Badge>
            case 'UPDATE': return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">UPDATE</Badge>
            case 'DELETE': return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">DELETE</Badge>
            default: return <Badge>{action}</Badge>
        }
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">Action:</span>
                    <Select value={actionFilter} onValueChange={(val) => { setActionFilter(val); setPage(0) }}>
                        <SelectTrigger className="w-[140px] h-9">
                            <SelectValue placeholder="All Actions" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Actions</SelectItem>
                            <SelectItem value="INSERT">Insert</SelectItem>
                            <SelectItem value="UPDATE">Update</SelectItem>
                            <SelectItem value="DELETE">Delete</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">Table:</span>
                    <Select value={tableFilter} onValueChange={(val) => { setTableFilter(val); setPage(0) }}>
                        <SelectTrigger className="w-[180px] h-9">
                            <SelectValue placeholder="All Tables" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Tables</SelectItem>
                            <SelectItem value="production_logs">Production Logs</SelectItem>
                            <SelectItem value="attendance">Attendance</SelectItem>
                            <SelectItem value="workers">Workers</SelectItem>
                            <SelectItem value="fixed_workers">Fixed Workers</SelectItem>
                            <SelectItem value="machines">Machines</SelectItem>
                            <SelectItem value="orders">Orders</SelectItem>
                            <SelectItem value="yarn_batches">Yarn Batches</SelectItem>
                            <SelectItem value="payroll_payments">Payroll Payments</SelectItem>
                            <SelectItem value="worker_advances">Worker Advances</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-md border border-gray-200 shadow-sm overflow-hidden bg-white">
                <Table>
                    <TableHeader className="bg-gray-50/50">
                        <TableRow>
                            <TableHead className="w-[180px]">Timestamp</TableHead>
                            <TableHead className="w-[100px]">Action</TableHead>
                            <TableHead className="w-[140px]">Entity / ID</TableHead>
                            <TableHead className="w-[180px]">Actor</TableHead>
                            <TableHead>Changes</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center">
                                    <div className="flex flex-col items-center justify-center text-gray-500 gap-2">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        <p className="text-sm">Loading audit logs...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : data?.items?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center text-gray-500">
                                    No audit logs found for the selected filters.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data?.items?.map((log: any) => (
                                <TableRow key={log.id} className="text-sm border-gray-100">
                                    <TableCell className="align-top whitespace-nowrap text-gray-600">
                                        {format(new Date(log.changed_at), "dd MMM yyyy, HH:mm")}
                                    </TableCell>
                                    <TableCell className="align-top">
                                        <ActionBadge action={log.action} />
                                    </TableCell>
                                    <TableCell className="align-top">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-gray-900">{log.table_name}</span>
                                            <span className="text-xs text-gray-400 truncate max-w-[120px]" title={log.record_id}>ID: {log.record_id}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="align-top">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-800">
                                                {/* @ts-ignore */}
                                                {log.profiles?.name || 'Unknown User'}
                                            </span>
                                            {/* @ts-ignore */}
                                            {log.profiles?.role && (
                                                <span className="text-xs text-gray-500 capitalize">
                                                    {/* @ts-ignore */}
                                                    {log.profiles.role}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="align-top">
                                        <AuditDiff oldData={log.old_data} newData={log.new_data} />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            {data?.count && data.count > PAGE_SIZE && (
                <div className="flex items-center justify-between px-2">
                    <p className="text-sm text-gray-500">
                        Showing {page * PAGE_SIZE + 1} to {Math.min((page + 1) * PAGE_SIZE, data.count)} of {data.count} entries
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => p + 1)}
                            disabled={(page + 1) * PAGE_SIZE >= data.count}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
