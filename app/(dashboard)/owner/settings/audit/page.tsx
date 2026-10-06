'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import AuditTable from './AuditTable'
import { useOwnerPlan } from '@/components/providers/owner-plan-provider'
import styles from './lite-audit.module.css'
import { History } from 'lucide-react'

export default function AuditTrailPage() {
    const lite = useOwnerPlan() === 'lite'
    return (
        <div className={`mx-auto w-full max-w-6xl space-y-6 pb-10 ${lite ? styles.page : ''}`}>
            <div className="border-b border-hairline/80 pb-5 text-center">
                <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:text-[2rem]">Audit Trail</h1>
            </div>

            <Card className="shadow-[var(--shadow-card)] border-[var(--wv-border-default)] overflow-hidden">
                <CardHeader className="bg-[var(--wv-bg-subtle)] border-b border-[var(--wv-border-subtle)]">
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-[var(--wv-action-primary)]" />
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
