import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import QualityStockClient from '../../../app/(dashboard)/owner/stock/QualityStockClient'
import { I18nProvider } from '../../../lib/i18n/context'
import { LanguageSwitcher } from '../../../components/i18n/language-switcher'
import { getQualityStockBoard } from './actions'
import type { QualityStockBoard } from '../../../lib/quality-stock'
import '../../../app/globals.css'
function Harness() {
    const [data, setData] = useState<QualityStockBoard | null>(null)
    useEffect(() => { void getQualityStockBoard().then(result => { if ('data' in result) setData(result.data) }) }, [])
    return <I18nProvider><main className="mx-auto max-w-6xl p-4 sm:p-8"><div className="mb-4 flex justify-start"><LanguageSwitcher placement="bottom" /></div>{data ? <QualityStockClient initialData={data} /> : <p>Loading local fixture…</p>}</main></I18nProvider>
}
createRoot(document.getElementById('root')!).render(<Harness />)
