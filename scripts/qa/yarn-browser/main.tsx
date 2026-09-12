import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import YarnStockClient from '../../../app/(dashboard)/owner/stock/YarnStockClient'
import { I18nProvider } from '../../../lib/i18n/context'
import { LanguageSwitcher } from '../../../components/i18n/language-switcher'
import { getYarnStockBoard } from './actions'
import type { YarnBoard } from '../../../lib/yarn-stock'
import '../../../app/globals.css'
function Harness() {
    const [data, setData] = useState<YarnBoard | null>(null)
    useEffect(() => { void getYarnStockBoard().then(result => { if ('data' in result) setData(result.data) }) }, [])
    return <I18nProvider><main className="mx-auto max-w-6xl p-4 sm:p-8"><div className="mb-4"><LanguageSwitcher placement="bottom" /></div>{data ? <YarnStockClient initialData={data} /> : <p>Loading local fixture…</p>}</main></I18nProvider>
}
createRoot(document.getElementById('root')!).render(<Harness />)
