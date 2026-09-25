'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import AuditTable from './AuditTable'
import { History } from 'lucide-react'

export default function AuditTrailPage() {
    return (
        <div className="mx-auto w-full max-w-6xl space-y-6 pb-10">
            <div className="border-b border-hairline/80 pb-5 text-center">
                <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:text-[2rem]">Audit Trail</h1>
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
