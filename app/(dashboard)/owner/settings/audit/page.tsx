'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import AuditTable from './AuditTable'
import { History } from 'lucide-react'

export default function AuditTrailPage() {
    return (
        <div className="space-y-6 max-w-6xl pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    View a complete history of changes made to sensitive data in your factory.
                </p>
            </div>

            <Card className="shadow-sm border-gray-200">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-indigo-600" />
                        <CardTitle>Change Log</CardTitle>
                    </div>
                    <CardDescription>
                        Records of changes to production logs, attendance, workers, advances, and more.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <AuditTable />
                </CardContent>
            </Card>
        </div>
    )
}
