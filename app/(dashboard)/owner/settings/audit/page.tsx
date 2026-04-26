'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import AuditTable from './AuditTable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ComplianceRegistry from './ComplianceRegistry'
import { History, ShieldCheck } from 'lucide-react'

export default function AuditTrailPage() {
    return (
        <div className="space-y-6 max-w-6xl pb-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Governance & Compliance</h1>
                <p className="text-gray-500">Monitor system integrity and DPDP Act 2026 adherence.</p>
            </div>

            <Tabs defaultValue="activity" className="space-y-6">
                <TabsList className="bg-gray-100/50 border border-gray-200 p-1 rounded-2xl h-12 w-fit">
                    <TabsTrigger value="activity" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 gap-2">
                        <History className="h-4 w-4" />
                        System Activity
                    </TabsTrigger>
                    <TabsTrigger value="compliance" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        DPDP Compliance
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="activity" className="space-y-6 outline-none">
                    <Card className="shadow-sm border-gray-200 overflow-hidden">
                        <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <History className="h-5 w-5 text-indigo-600" />
                                <CardTitle>Audit Trail</CardTitle>
                            </div>
                            <CardDescription>
                                Immutable history of production, payroll, and profile changes.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <AuditTable />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="compliance" className="outline-none">
                    <ComplianceRegistry />
                </TabsContent>
            </Tabs>
        </div>
    )
}
