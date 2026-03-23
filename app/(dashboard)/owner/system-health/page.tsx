'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Server, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n/context'

interface DailyBriefLog {
    id: string
    org_id: string
    report_date: string
    status: 'success' | 'failed' | 'skipped'
    details: any
    sent_at: string
}

export default function SystemHealthPage() {
    const { t } = useTranslation()
    const supabase = createClient()

    const { data: userProfile } = useUserProfile()

    const { data: logs, isLoading } = useQuery({
        queryKey: ['daily_brief_logs', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('daily_brief_logs')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .order('sent_at', { ascending: false })
                .limit(30)
            if (error) throw error
            return data as DailyBriefLog[]
        }
    })

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                    <Server className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('system_health.title')}</h1>
                    <p className="text-sm text-gray-500">{t('system_health.subtitle')}</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('system_health.logs.title')}</CardTitle>
                    <CardDescription>{t('system_health.logs.desc')}</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="flex gap-4 py-3 border-b">
                                    <Skeleton className="h-5 w-40" />
                                    <Skeleton className="h-5 w-32" />
                                    <Skeleton className="h-5 w-20 mx-auto" />
                                    <Skeleton className="h-5 w-48" />
                                </div>
                            ))}
                        </div>
                    ) : !logs || logs.length === 0 ? (
                        <div className="py-12 text-center text-gray-500">
                            <Server className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                            <p>{t('system_health.logs.empty')}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3">{t('system_health.logs.cols.timestamp')}</th>
                                        <th className="px-4 py-3">{t('system_health.logs.cols.target_date')}</th>
                                        <th className="px-4 py-3 text-center">{t('system_health.logs.cols.status')}</th>
                                        <th className="px-4 py-3">{t('system_health.logs.cols.details')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50/50">
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                                                {format(new Date(log.sent_at), 'PPP pp')}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-900 font-medium">
                                                {format(new Date(log.report_date), 'PP')}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {log.status === 'success' ? (
                                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1.5">
                                                        <CheckCircle2 className="h-3.5 w-3.5" /> {t('system_health.logs.status.success')}
                                                    </Badge>
                                                ) : log.status === 'skipped' ? (
                                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 gap-1.5">
                                                        <Clock className="h-3.5 w-3.5" /> {t('system_health.logs.status.skipped')}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1.5">
                                                        <XCircle className="h-3.5 w-3.5" /> {t('system_health.logs.status.failed')}
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 truncate max-w-xs">
                                                {log.status === 'failed' && log.details?.error ? (
                                                    <span className="text-red-600" title={log.details.error}>{log.details.error}</span>
                                                ) : log.status === 'skipped' ? (
                                                    <span className="text-yellow-600">{t('system_health.logs.details.no_phone')}</span>
                                                ) : (
                                                    <span className="text-green-600">{t('system_health.logs.details.prepared')}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
