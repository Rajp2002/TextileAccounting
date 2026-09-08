'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Layers } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
import InventoryClient from './InventoryClient'
import type { InventoryModuleData } from './actions'

type InventoryTab = 'yarn' | 'beams' | 'grey-stock'

export default function OwnerInventoryClient({
    inventoryData,
    beamTrackingEnabled,
}: {
    inventoryData: InventoryModuleData
    beamTrackingEnabled: boolean
}) {
    const { t } = useTranslation()
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const activeTab = useMemo<InventoryTab>(() => {
        const value = searchParams.get('tab')
        if (value === 'beams' || value === 'grey-stock') return value
        return 'yarn'
    }, [searchParams])

    const setTab = (tab: InventoryTab) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('tab', tab)
        router.replace(`${pathname}?${params.toString()}`)
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-slate-900">{t('nav.inventory')}</h1>
                <p className="text-sm text-slate-600">{t('inventory.unifiedSubtitle')}</p>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setTab(value as InventoryTab)} className="gap-4">
                <TabsList className="w-full justify-start">
                    <TabsTrigger value="yarn">{t('inventory.tabs.yarn')}</TabsTrigger>
                    <TabsTrigger value="beams">{t('inventory.tabs.beams')}</TabsTrigger>
                    <TabsTrigger value="grey-stock">{t('inventory.tabs.greyStock')}</TabsTrigger>
                </TabsList>

                {activeTab === 'yarn' ? (
                    <InventoryClient initialData={inventoryData} activeView="yarn" />
                ) : null}

                {activeTab === 'beams' ? (
                    beamTrackingEnabled ? (
                        <InventoryClient initialData={inventoryData} activeView="beams" />
                    ) : (
                        <Card className="border-dashed border-slate-300">
                            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="mb-4 rounded-full bg-slate-100 p-3 text-slate-500">
                                    <Layers className="h-6 w-6" />
                                </div>
                                <p className="text-lg font-bold text-slate-800">{t('inventory.beams.disabledTitle')}</p>
                                <p className="mt-2 max-w-md text-sm text-slate-500">{t('inventory.beams.disabledBody')}</p>
                                <Button asChild className="mt-5">
                                    <Link href="/owner/settings">{t('inventory.beams.enableCta')}</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    )
                ) : null}

                {activeTab === 'grey-stock' ? (
                    <Button asChild><Link href="/owner/stock">{t('nav.stock')}</Link></Button>
                ) : null}
            </Tabs>
        </div>
    )
}
