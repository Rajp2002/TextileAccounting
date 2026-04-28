'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import AuditTable from './AuditTable'
import { History } from 'lucide-react'

export default function AuditTrailPage() {
    return (
        <div className="space-y-6 max-w-6xl pb-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Audit Trail</h1>
                <p className="text-gray-500">Monitor production, payroll, and profile changes in one place.</p>
            </div>

            <Card className="shadow-sm border-gray-200 overflow-hidden">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-indigo-600" />
                        <CardTitle>System Activity</CardTitle>
                    </div>
                    <CardDescription>
                        Immutable history of production, payroll, and profile changes.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <AuditTable />
                </CardContent>
            </Card>
        </div>
    )
}
