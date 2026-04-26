'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Globe, FileText, CheckCircle2, MessageCircle, Clock, Volume2 } from 'lucide-react'
import { useUserProfile } from '@/hooks/use-user-profile'
import { format } from 'date-fns'

interface Notice {
    id: string
    version_string: string
    language_code: string
    is_active: boolean
    notice_type: string
    body_text: string
    content_audio_url?: string
    created_at: string
}

interface LanguageRequest {
    id: string
    language_code: string
    worker_name_hint?: string
    requested_at: string
}

export default function ComplianceRegistry() {
    const supabase = createClient()
    const { data: userProfile } = useUserProfile()

    // Fetch Notice Registry
    const { data: notices, isLoading: loadingNotices } = useQuery({
        queryKey: ['notice_registry'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('notice_registry')
                .select('*')
                .order('version_string', { ascending: false })
                .order('language_code', { ascending: true })
            if (error) throw error
            return data
        }
    })

    // Fetch Language Requests
    const { data: requests, isLoading: loadingRequests } = useQuery({
        queryKey: ['language_requests', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('language_requests')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .order('requested_at', { ascending: false })
            if (error) throw error
            return data
        }
    })

    const isLoading = loadingNotices || loadingRequests

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-sm text-gray-500 font-medium">Loading Compliance Data...</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Notices Registry (Active versions) */}
            <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-indigo-600" />
                    <h2 className="text-lg font-bold text-gray-900">Active Notice Registry</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {notices?.map((notice: Notice) => (
                        <Card key={notice.id} className="shadow-sm border-gray-100 hover:shadow-md transition-all overflow-hidden">
                            <CardHeader className="pb-3 bg-gray-50/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="bg-white text-[10px] font-bold border-gray-200">
                                            {notice.version_string}
                                        </Badge>
                                        <Badge className="bg-indigo-600 hover:bg-indigo-600 text-[10px] font-bold uppercase">
                                            {notice.language_code}
                                        </Badge>
                                    </div>
                                    {notice.is_active && (
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase">
                                            <CheckCircle2 className="h-3 w-3" /> Active
                                        </div>
                                    )}
                                </div>
                                <CardTitle className="text-sm font-bold mt-2 capitalize">
                                    {notice.notice_type.replace('_', ' ')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">
                                    {notice.body_text}
                                </p>
                                <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                                    <div className="flex items-center gap-1.5">
                                        {notice.content_audio_url ? (
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 text-[9px] py-0">
                                                <Volume2 className="h-2.5 w-2.5 mr-1" /> Audio Ready
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-gray-50 text-gray-400 border-gray-200 text-[9px] py-0">
                                                Text Only
                                            </Badge>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-gray-400 font-medium">
                                        {format(new Date(notice.created_at), 'MMM d, yyyy')}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Language Requests */}
            <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                    <MessageCircle className="h-5 w-5 text-orange-600" />
                    <h2 className="text-lg font-bold text-gray-900">Language Requests</h2>
                </div>

                <Card className="shadow-sm border-orange-100 bg-orange-50/20">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-orange-800 font-medium">
                            Pending requests from workers for scheduled languages.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 px-2">
                        {requests?.length === 0 ? (
                            <div className="py-10 text-center space-y-2">
                                <Globe className="h-8 w-8 text-orange-200 mx-auto" />
                                <p className="text-sm text-orange-600/60 font-medium italic">No pending requests</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {requests?.map((req: LanguageRequest) => (
                                    <div key={req.id} className="bg-white p-3 rounded-xl border border-orange-100 shadow-sm flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs uppercase">
                                                {req.language_code.slice(0, 2)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 uppercase">{req.language_code}</p>
                                                <p className="text-[10px] text-gray-500 font-medium">
                                                    Requested for: {req.worker_name_hint || 'Unnamed Worker'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="outline" className="bg-white border-gray-200 text-gray-500 text-[9px] mb-1">
                                                <Clock className="h-2 w-2 mr-1" /> Pending
                                            </Badge>
                                            <p className="text-[9px] text-gray-400 font-medium">
                                                {format(new Date(req.requested_at), 'MMM d')}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
