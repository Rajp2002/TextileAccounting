import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import ChallansClient from '../../../app/(dashboard)/owner/dispatches/ChallansClient'
import ChallanPrint from '../../../app/(dashboard)/owner/dispatches/ChallanPrint'
import { I18nProvider } from '../../../lib/i18n/context'
import { LanguageSwitcher } from '../../../components/i18n/language-switcher'
import { getChallan, listChallans, request } from './actions'
import type { Challan } from '../../../lib/delivery-challans'
import type { StockQuality } from '../../../lib/quality-stock'
import type { LegacyStock } from '../../../lib/legacy-stock'
import '../../../app/globals.css'
function Harness() {
    const [data, setData] = useState<{
            rows: Challan[]
            qualities: StockQuality[]
            legacy: LegacyStock[]
        } | null>(null),
        [print, setPrint] = useState<Challan | null>(null)
    useEffect(() => {
        const id = location.pathname.match(/dispatches\/([^/]+)\/print/)?.[1]
        if (id) {
            void getChallan(id).then((r) => setPrint(r.data ?? null))
            return
        }
        void Promise.all([listChallans(), request('stock')]).then(
            ([rows, stock]) =>
                setData({
                    rows: rows.data!,
                    qualities: stock.qualities,
                    legacy: stock.legacy ?? [],
                }),
        )
    }, [])
    return (
        <I18nProvider>
            {print ? (
                <ChallanPrint d={print} />
            ) : (
                <>
                    <LanguageSwitcher placement="bottom" />
                    {data ? (
                        <ChallansClient
                            initialData={data.rows}
                            qualities={data.qualities}
                            legacy={data.legacy}
                        />
                    ) : (
                        <p>Loading local fixture…</p>
                    )}
                </>
            )}
        </I18nProvider>
    )
}
createRoot(document.getElementById('root')!).render(<Harness />)
